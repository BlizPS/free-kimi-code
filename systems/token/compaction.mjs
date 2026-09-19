import { estimateTokens } from './index.mjs';

const PROTECTED = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /https?:\/\/\S+/gi,
  /(?:^|\s)(?:\.?\.\/)?[\w.-]+(?:[\\/]?[\w.-]+)+(?:\s|$)/g,
  /\b\d+(?:\.\d+){2,}\b/g,
];
const ERROR_SIGNAL = /\b(error|failed|failure|exception|denied|timeout|429|500|401|403|not found|invalid)\b/i;

function preserve(text, transform) {
  const saved = [];
  let value = String(text ?? '');
  for (const pattern of PROTECTED) {
    pattern.lastIndex = 0;
    value = value.replace(pattern, (match) => {
      const index = saved.push(match) - 1;
      return `\u0000P${index}\u0000`;
    });
  }
  value = transform(value);
  value = value.replace(/\u0000P(\d+)\u0000/g, (_, index) => saved[Number(index)] ?? '');
  return value;
}

export function compactText(text, maxTokens = 600) {
  const input = String(text ?? '').trim();
  if (!input || estimateTokens(input) <= maxTokens) return input;
  const maxChars = Math.max(240, maxTokens * 4);
  return preserve(input, (value) => {
    const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const highSignal = lines.filter((line) => ERROR_SIGNAL.test(line) || /^[-*]\s/.test(line));
    const keep = [...highSignal, ...lines.filter((line) => !highSignal.includes(line))];
    let out = '';
    for (const line of keep) {
      const candidate = out ? `${out}\n${line}` : line;
      if (candidate.length > maxChars) break;
      out = candidate;
    }
    if (!out) out = value.slice(0, maxChars);
    return out;
  });
}

export function compactMessages(messages = [], options = {}) {
  const budget = Math.max(256, Number(options.tokenBudget) || 8192);
  const pinned = Number(options.keepRecent ?? 6);
  const source = Array.isArray(messages) ? messages : [];
  const ranked = source.map((message, index) => ({
    message: message || {},
    index,
    raw: typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? ''),
    mustKeep: index >= source.length - pinned || message?.role === 'system' || message?.pinned === true,
  }));
  const preferred = [
    ...ranked.filter((item) => item.message.role === 'system'),
    ...ranked.filter((item) => item.message.role !== 'system').slice(-pinned),
  ].filter((item, index, all) => all.findIndex((other) => other.index === item.index) === index);
  preferred.sort((a, b) => a.index - b.index);

  const selected = [];
  let used = 0;
  for (const item of preferred) {
    const remaining = budget - used;
    if (remaining <= 0) break;
    const fullCost = estimateTokens(item.raw);
    const target = Math.max(16, Math.min(fullCost, remaining));
    const content = fullCost <= remaining ? item.raw : compactText(item.raw, target);
    const cost = Math.min(remaining, estimateTokens(content));
    if (!content && item.message.role !== 'system') continue;
    selected.push({ ...item.message, content });
    used += cost;
    if (used >= budget) break;
  }
  selected.sort((a, b) => source.indexOf(a) - source.indexOf(b));
  return { messages: selected, estimatedTokens: used, budget, dropped: Math.max(0, source.length - selected.length) };
}
