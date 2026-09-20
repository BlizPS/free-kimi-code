/**
 * Foveance-inspired context codec for LazyDev.
 *
 * The important distinction is transport-level compression: the transformed message
 * body is what the provider receives, so input tokens can actually fall instead of
 * merely becoming a shorter internal prompt string.
 *
 * Default production policy is conservative:
 * - never touch the newest messages
 * - only touch older tool-result text
 * - only replace repeated lines when the marker is cheaper
 * - never touch tool-call IDs/arguments or cache_control blocks
 * - preserve the first occurrence so a model can resolve a repeat marker from context
 */

const REPEAT_PREFIX = '[lazy-repeat';
const DEFAULT_PROTECT_LAST = 6;
const DEFAULT_MIN_CHARS = 1200;
const DEFAULT_MIN_LINE_CHARS = 24;
const DEFAULT_MAX_CANDIDATES = 96;

function countTokens(text, counter) {
  if (typeof counter === 'function') return Math.max(1, Number(counter(String(text ?? ''))) || 1);
  return Math.max(1, Math.ceil(String(text ?? '').length / 4));
}

function refText(length, sourceIndex, sourceLine) {
  return `${REPEAT_PREFIX} ${length} @m${sourceIndex + 1}:L${sourceLine + 1}]`;
}

function isCacheProtectedBlock(block) {
  return Boolean(block && typeof block === 'object' && block.cache_control);
}

function isToolResultMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (message.role === 'tool') return true;
  if (message.role === 'function') return true;
  if (Array.isArray(message.content)) {
    return message.content.some((block) => block && typeof block === 'object' && block.type === 'tool_result');
  }
  return false;
}

function splitLines(text) {
  return String(text ?? '').split(/\r?\n/);
}

function looksEligibleText(text, minChars) {
  return typeof text === 'string' && text.length >= minChars && text.includes('\n');
}

function payloadTextRef(messageIndex, location, text) {
  return { messageIndex, location, text };
}

function findLastCacheBoundary(messages) {
  let boundary = -1;
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message || typeof message !== 'object') continue;
    if (isCacheProtectedBlock(message)) boundary = i;
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (isCacheProtectedBlock(block)) { boundary = i; break; }
        if (Array.isArray(block?.content) && block.content.some(isCacheProtectedBlock)) { boundary = i; break; }
      }
    }
  }
  return boundary;
}

function collectEligiblePayloads(messages, { protectLast, minChars } = {}) {
  const source = Array.isArray(messages) ? messages : [];
  const firstEligibleIndex = Math.max(0, source.length - Math.max(0, protectLast));
  const cacheBoundary = findLastCacheBoundary(source);
  const payloads = [];

  for (let i = 0; i < source.length; i += 1) {
    if (i >= firstEligibleIndex || i <= cacheBoundary) continue;
    const message = source[i];
    if (!isToolResultMessage(message)) continue;

    if (message.role === 'tool' || message.role === 'function') {
      if (looksEligibleText(message.content, minChars)) {
        payloads.push(payloadTextRef(i, { kind: 'message-content' }, message.content));
      }
      continue;
    }

    if (!Array.isArray(message.content)) continue;
    for (let bi = 0; bi < message.content.length; bi += 1) {
      const block = message.content[bi];
      if (isCacheProtectedBlock(block) || !block || typeof block !== 'object') continue;
      if (block.type !== 'tool_result') continue;
      if (typeof block.content === 'string' && looksEligibleText(block.content, minChars)) {
        payloads.push(payloadTextRef(i, { kind: 'block-content', blockIndex: bi }, block.content));
      } else if (Array.isArray(block.content)) {
        for (let ci = 0; ci < block.content.length; ci += 1) {
          const child = block.content[ci];
          if (isCacheProtectedBlock(child) || !child || typeof child !== 'object') continue;
          if (child.type === 'text' && looksEligibleText(child.text, minChars)) {
            payloads.push(payloadTextRef(i, { kind: 'child-text', blockIndex: bi, childIndex: ci }, child.text));
          }
        }
      }
    }
  }
  return payloads;
}

function renderLosslessReferences(payloads, { tokenCounter, minLineChars, maxCandidates } = {}) {
  const count = (text) => countTokens(text, tokenCounter);
  const history = [];
  const index = new Map();
  const replacementByKey = new Map();
  let savedTokens = 0;
  let replacedLines = 0;
  let references = 0;

  const remember = (line, sourceIndex, sourceLine) => {
    const arr = index.get(line) || [];
    arr.push({ sourceIndex, sourceLine, historyPos: history.length });
    if (arr.length > maxCandidates) arr.shift();
    index.set(line, arr);
    history.push({ line, sourceIndex, sourceLine });
  };

  for (let payloadPos = 0; payloadPos < payloads.length; payloadPos += 1) {
    const payload = payloads[payloadPos];
    const lines = splitLines(payload.text);
    const rendered = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const candidates = index.get(line) || [];
      let best = null;

      for (const candidate of [...candidates].reverse()) {
        let length = 0;
        while (
          i + length < lines.length &&
          candidate.historyPos + length < history.length &&
          lines[i + length] === history[candidate.historyPos + length].line
        ) {
          length += 1;
        }
        if (!best || length > best.length) best = { ...candidate, length };
      }

      if (best && best.length > 0) {
        const replaced = lines.slice(i, i + best.length);
        const marker = refText(best.length, best.sourceIndex, best.sourceLine);
        const literalCost = replaced.reduce((sum, item) => sum + count(item), 0);
        const markerCost = count(marker);
        const longEnough = replaced.some((item) => item.length >= minLineChars);
        if (longEnough && markerCost < literalCost) {
          rendered.push(marker);
          savedTokens += literalCost - markerCost;
          replacedLines += best.length;
          references += 1;
          for (let j = 0; j < best.length; j += 1) {
            remember(lines[i + j], payload.messageIndex, i + j);
          }
          i += best.length;
          continue;
        }
      }

      rendered.push(line);
      remember(line, payload.messageIndex, i);
      i += 1;
    }

    replacementByKey.set(`${payload.messageIndex}:${JSON.stringify(payload.location)}`, rendered.join('\n'));
  }

  return { replacementByKey, savedTokens, replacedLines, references };
}

function longestPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length && prefix; i += 1) {
    const value = strings[i];
    let j = 0;
    const n = Math.min(prefix.length, value.length);
    while (j < n && prefix[j] === value[j]) j += 1;
    prefix = prefix.slice(0, j);
  }
  return prefix;
}

function templateText(text, { tokenCounter, minRun = 3, minPrefix = 12 } = {}) {
  const count = (value) => countTokens(value, tokenCounter);
  const lines = splitLines(text);
  const out = [];
  let savedTokens = 0;
  let templates = 0;
  let i = 0;
  while (i < lines.length) {
    if (lines[i]?.startsWith(REPEAT_PREFIX) || lines[i]?.startsWith('[lazy-template ')) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    let best = null;
    for (let run = minRun; i + run <= lines.length; run += 1) {
      const chunk = lines.slice(i, i + run);
      if (chunk.some((line) => line.length < minPrefix || line.startsWith(REPEAT_PREFIX))) continue;
      const prefix = longestPrefix(chunk);
      if (prefix.length < minPrefix) continue;
      const header = `[lazy-template ${run} ${JSON.stringify(prefix)}]`;
      const suffixes = chunk.map((line) => line.slice(prefix.length));
      const before = chunk.reduce((sum, line) => sum + count(line), 0);
      const after = count(header) + suffixes.reduce((sum, line) => sum + count(line), 0);
      if (after + 1 < before && (!best || before - after > best.saved)) {
        best = { run, prefix, header, suffixes, saved: before - after, before, after };
      }
    }
    if (best) {
      out.push(best.header, ...best.suffixes);
      savedTokens += best.saved;
      templates += 1;
      i += best.run;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return { text: out.join('\n'), savedTokens, templates };
}

function readReplacement(replacements, messageIndex, location) {
  return replacements.get(`${messageIndex}:${JSON.stringify(location)}`);
}

export function compressAgenticMessages(messages = [], options = {}) {
  const source = Array.isArray(messages) ? messages : [];
  const protectLast = Math.max(0, Number(options.protectLast ?? DEFAULT_PROTECT_LAST));
  const minChars = Math.max(256, Number(options.minChars ?? DEFAULT_MIN_CHARS));
  const minLineChars = Math.max(8, Number(options.minLineChars ?? DEFAULT_MIN_LINE_CHARS));
  const maxCandidates = Math.max(8, Number(options.maxCandidates ?? DEFAULT_MAX_CANDIDATES));
  const useTemplate = options.template === true || options.template === 'on' || options.template === 'auto';
  const templateMinRun = Math.max(3, Number(options.templateMinRun ?? 3));
  const templateMinPrefix = Math.max(8, Number(options.templateMinPrefix ?? 12));
  const templateMinSavedTokens = Math.max(32, Number(options.templateMinSavedTokens ?? 64));
  const cacheBoundary = findLastCacheBoundary(source);
  const payloads = collectEligiblePayloads(source, { protectLast, minChars });
  if (!payloads.length) {
    return { messages: source, changed: false, savedTokens: 0, beforeChars: 0, afterChars: 0, eligiblePayloads: 0, references: 0, replacedLines: 0, templateSavedTokens: 0, templateReferences: 0, cacheBoundary };
  }

  const beforeChars = payloads.reduce((sum, payload) => sum + payload.text.length, 0);
  const { replacementByKey, savedTokens, replacedLines, references } = renderLosslessReferences(payloads, {
    tokenCounter: options.tokenCounter,
    minLineChars,
    maxCandidates,
  });
  let changed = false;
  let templateSavedTokens = 0;
  let templateReferences = 0;
  const next = source.map((message, index) => {
    const replacement = message && typeof message === 'object' ? { ...message } : message;
    if (!replacement || !isToolResultMessage(replacement)) return replacement;

    if ((replacement.role === 'tool' || replacement.role === 'function') && typeof replacement.content === 'string') {
      const value = readReplacement(replacementByKey, index, { kind: 'message-content' });
      if (value != null && value !== replacement.content) {
        changed = true;
        replacement.content = value;
      }
      return replacement;
    }

    if (!Array.isArray(replacement.content)) return replacement;
    replacement.content = replacement.content.map((block, bi) => {
      if (isCacheProtectedBlock(block) || !block || typeof block !== 'object' || block.type !== 'tool_result') return block;
      if (typeof block.content === 'string') {
        const value = readReplacement(replacementByKey, index, { kind: 'block-content', blockIndex: bi });
        if (value != null && value !== block.content) {
          changed = true;
          return { ...block, content: value };
        }
        return block;
      }
      if (!Array.isArray(block.content)) return block;
      const content = block.content.map((child, ci) => {
        if (isCacheProtectedBlock(child) || !child || typeof child !== 'object' || child.type !== 'text') return child;
        const value = readReplacement(replacementByKey, index, { kind: 'child-text', blockIndex: bi, childIndex: ci });
        if (value != null && value !== child.text) {
          changed = true;
          return { ...child, text: value };
        }
        return child;
      });
      return content.some((item, i) => item !== block.content[i]) ? { ...block, content } : block;
    });
    return replacement;
  });

  if (useTemplate) {
    for (let i = 0; i < next.length; i += 1) {
      if (i >= source.length - protectLast || i <= cacheBoundary) continue;
      const message = next[i];
      if (!isToolResultMessage(message)) continue;
      const applyText = (text) => {
        if (typeof text !== 'string' || text.length < minChars) return text;
        const result = templateText(text, { tokenCounter: options.tokenCounter, minRun: templateMinRun, minPrefix: templateMinPrefix });
        if (result.savedTokens < templateMinSavedTokens || result.text === text) return text;
        templateSavedTokens += result.savedTokens;
        templateReferences += result.templates;
        changed = true;
        return result.text;
      };
      if ((message.role === 'tool' || message.role === 'function') && typeof message.content === 'string') {
        message.content = applyText(message.content);
      } else if (Array.isArray(message.content)) {
        message.content = message.content.map((block) => {
          if (isCacheProtectedBlock(block) || !block || typeof block !== 'object' || block.type !== 'tool_result') return block;
          if (typeof block.content === 'string') return { ...block, content: applyText(block.content) };
          if (!Array.isArray(block.content)) return block;
          return { ...block, content: block.content.map((child) => {
            if (isCacheProtectedBlock(child) || !child || typeof child !== 'object' || child.type !== 'text') return child;
            return { ...child, text: applyText(child.text) };
          }) };
        });
      }
    }
  }

  const afterChars = next.reduce((sum, message, index) => {
    const before = source[index];
    if (!message || typeof message !== 'object' || !isToolResultMessage(message)) return sum;
    if ((message.role === 'tool' || message.role === 'function') && typeof message.content === 'string') return sum + message.content.length;
    if (Array.isArray(message.content)) {
      return sum + message.content.reduce((inner, block) => {
        if (block?.type === 'tool_result') {
          if (typeof block.content === 'string') return inner + block.content.length;
          if (Array.isArray(block.content)) return inner + block.content.reduce((n, child) => n + (typeof child?.text === 'string' ? child.text.length : 0), 0);
        }
        return inner;
      }, 0);
    }
    return before ? sum : sum;
  }, 0);

  return {
    messages: changed ? next : source,
    changed,
    savedTokens: Math.max(0, savedTokens),
    beforeChars,
    afterChars: changed ? afterChars : beforeChars,
    eligiblePayloads: payloads.length,
    references,
    replacedLines,
    templateSavedTokens,
    templateReferences,
    cacheBoundary,
    losslessRepresentation: true,
  };
}

export function hasRepeatMarkers(text) {
  return typeof text === 'string' && text.includes(REPEAT_PREFIX);
}

export const FOVEANCE_DEFAULTS = Object.freeze({
  protectLast: DEFAULT_PROTECT_LAST,
  minChars: DEFAULT_MIN_CHARS,
  minLineChars: DEFAULT_MIN_LINE_CHARS,
  maxCandidates: DEFAULT_MAX_CANDIDATES,
});
