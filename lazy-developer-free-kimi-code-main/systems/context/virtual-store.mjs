import { fingerprint } from './fingerprint.mjs';

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','how','in','is','it','of','on','or','that','the','this','to','was','what','when','where','which','who','why','with','yang','dan','atau','di','ke','dari','ini','itu','untuk','dengan','ga','nggak','ngga','gak'
]);
const PATH_RES = [
  /(?:\/storage\/emulated\/0\/|storage\/emulated\/0\/|lazydevfile\/)[^\s<>"']+/ig,
  /(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:html?|css|js|mjs|json|md|txt|py|ts|tsx|jsx|vue|svelte|astro)\b/ig,
];

function terms(text = '') {
  return [...new Set(String(text).toLowerCase().split(/[^a-z0-9_]+/).filter((term) => term.length > 1 && !STOPWORDS.has(term)))];
}
function extractPaths(text = '') {
  const out = [];
  for (const re of PATH_RES) {
    for (const match of String(text).matchAll(re)) {
      const value = String(match[0] || '').trim().replace(/^[\s(]+|[\s),]+$/g, '');
      if (value && !out.includes(value)) out.push(value);
    }
  }
  return out;
}
function basename(value = '') {
  return String(value).replaceAll('\\', '/').split('/').pop()?.toLowerCase() || '';
}
function pathTerms(value = '') {
  return terms(basename(value).replace(/\.[a-z0-9]+$/i, ''));
}
function qPathTermsHasPath(qPathTerms, value = '') {
  const candidate = pathTerms(value);
  return candidate.some((term) => qPathTerms.has(term));
}
function approxTokens(text = '') {
  return Math.max(1, Math.ceil(String(text).length / 4));
}
function trimText(text, chars) {
  const value = String(text || '');
  if (value.length <= chars) return value;
  const head = Math.max(120, Math.floor(chars * 0.62));
  const tail = Math.max(80, chars - head - 40);
  return `${value.slice(0, head).trimEnd()}\n… [virtual-context chunked] …\n${value.slice(-tail).trimStart()}`;
}

export class VirtualContextStore {
  constructor(options = {}) {
    this.multiplier = Math.max(1.25, Math.min(4, Number(options.multiplier ?? 2.0)));
    this.maxSegments = Math.max(24, Math.min(512, Number(options.maxSegments ?? 192)));
    this.maxSegmentChars = Math.max(2000, Math.min(50000, Number(options.maxSegmentChars ?? 16000)));
    this.segments = new Map();
    this.storedTokens = 0;
    this.retrievedTokens = 0;
    this.lastQuery = '';
    this.lastHits = 0;
  }

  get capacityTokens() {
    const physical = Math.max(1024, Number(this.physicalContext || 16384));
    return Math.max(physical, Math.round(physical * this.multiplier));
  }

  setPhysicalContext(value) {
    this.physicalContext = Math.max(1024, Number(value) || 16384);
    this.maxStoredTokens = this.capacityTokens;
  }

  addSegment(segment) {
    const key = String(segment.id || fingerprint(`${segment.role}\n${segment.pathText}\n${segment.text}`));
    if (this.segments.has(key)) {
      const existing = this.segments.get(key);
      if (existing) existing.recency = Date.now();
      return false;
    }
    const text = trimText(segment.text, this.maxSegmentChars);
    const item = {
      id: key,
      role: String(segment.role || 'message'),
      text,
      paths: Array.isArray(segment.paths) ? [...segment.paths] : [],
      terms: terms(`${segment.text}\n${segment.paths?.join(' ') || ''}`),
      pathTerms: [...new Set((segment.paths || []).flatMap(pathTerms))],
      recency: Number(segment.recency || Date.now()),
      sourceIndex: Number(segment.sourceIndex || 0),
      tokens: approxTokens(text),
    };
    this.segments.set(key, item);
    this.storedTokens += item.tokens;
    this.evict();
    return true;
  }

  ingestMessages(messages = [], protectRecent = 10) {
    const source = Array.isArray(messages) ? messages : [];
    const stop = Math.max(0, source.length - Math.max(1, Number(protectRecent) || 10));
    let added = 0;
    for (let i = 0; i < stop; i += 1) {
      const message = source[i];
      if (!message || typeof message !== 'object') continue;
      if (message.role === 'system') continue;
      const text = typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map((part) => part?.text ?? part?.content ?? '').join('\n')
          : JSON.stringify(message.content ?? '');
      if (!text || text.length < 120) continue;
      const paths = extractPaths(text);
      if (message.role === 'tool' && !paths.length && text.length < 500) continue;
      const id = fingerprint(JSON.stringify({ role: message.role || 'message', content: text }));
      if (this.addSegment({ id, role: message.role, text, paths, sourceIndex: i, recency: Date.now() - ((source.length - i) * 1000) })) added += 1;
    }
    return added;
  }

  evict() {
    const limit = Math.max(1, Number(this.maxStoredTokens || this.capacityTokens));
    if (this.storedTokens <= limit && this.segments.size <= this.maxSegments) return;
    const ordered = [...this.segments.values()].sort((a, b) => a.recency - b.recency || a.sourceIndex - b.sourceIndex);
    while ((this.storedTokens > limit || this.segments.size > this.maxSegments) && ordered.length) {
      const victim = ordered.shift();
      if (!victim) break;
      if (this.segments.delete(victim.id)) this.storedTokens -= victim.tokens;
    }
  }

  retrieve(query = '', activePaths = [], budgetTokens = 4096) {
    const qTerms = new Set(terms(query));
    const qPathTerms = new Set(activePaths.flatMap(pathTerms));
    const maxTokens = Math.max(256, Number(budgetTokens) || 4096);
    const now = Date.now();
    const ranked = [...this.segments.values()].map((segment) => {
      let overlap = 0;
      for (const term of qTerms) if (segment.terms.includes(term)) overlap += 1;
      let pathOverlap = 0;
      for (const term of qPathTerms) if (segment.pathTerms.includes(term)) pathOverlap += 1;
      const lexical = qTerms.size ? overlap / qTerms.size : 0;
      const pathScore = qPathTerms.size ? pathOverlap / qPathTerms.size : 0;
      const htmlPaths = segment.paths.filter((value) => /\.html?$/i.test(String(value)));
      const hasHtmlPath = htmlPaths.length > 0;
      const hasFocusPath = qPathTerms.size > 0 && pathScore > 0;
      const hasOtherHtmlPath = qPathTerms.size > 0 && htmlPaths.some((value) => !qPathTermsHasPath(qPathTerms, value));
      const hasConflictingHtmlPath = qPathTerms.size > 0 && hasHtmlPath && (!hasFocusPath || hasOtherHtmlPath);
      const ageHours = Math.max(0, (now - Number(segment.recency || now)) / 3600000);
      const recency = 1 / (1 + ageHours / 24);
      // File affinity is a hard guard for explicit HTML focus: an archived page
      // about another HTML file is not eligible merely because generic words match.
      const score = lexical * 4 + pathScore * 8 + recency * 0.25;
      return { segment, score, lexical, pathScore, hasConflictingHtmlPath };
    }).filter((item) => (item.lexical > 0 || item.pathScore > 0) && !item.hasConflictingHtmlPath);

    ranked.sort((a, b) => b.score - a.score || b.segment.recency - a.segment.recency);
    const selected = [];
    let used = 0;
    for (const item of ranked) {
      if (selected.length && used + item.segment.tokens > maxTokens) continue;
      if (!selected.length && item.segment.tokens > maxTokens) {
        const truncated = { ...item.segment, text: trimText(item.segment.text, Math.max(800, maxTokens * 4)), tokens: maxTokens };
        selected.push(truncated);
        used += maxTokens;
        continue;
      }
      selected.push(item.segment);
      used += item.segment.tokens;
      if (used >= maxTokens) break;
    }
    this.lastQuery = String(query || '');
    this.lastHits = selected.length;
    this.retrievedTokens += used;
    return { segments: selected, tokens: used };
  }

  render(result = {}, activePaths = []) {
    const segments = Array.isArray(result.segments) ? result.segments : [];
    if (!segments.length) return '';
    const pathLine = activePaths.length ? `focus_files=${activePaths.slice(0, 8).join(', ')}` : '';
    const body = segments.map((segment, index) => {
      const source = segment.paths.length ? ` files=${segment.paths.slice(0, 6).join(',')}` : '';
      return `[${index + 1}] role=${segment.role}${source}\n${segment.text}`;
    }).join('\n\n');
    return `<lazydev-virtual-context>\nmode=retrieval; stored=${this.storedTokens}; capacity=${this.capacityTokens}; hits=${segments.length}; budget=${result.tokens}\n${pathLine}\nOnly use this archive when it is relevant to the current task. Do not treat unrelated file references as active context.\n${body}\n</lazydev-virtual-context>`;
  }

  snapshot() {
    return {
      version: 1,
      multiplier: this.multiplier,
      capacityTokens: this.capacityTokens,
      storedTokens: Math.max(0, this.storedTokens),
      segmentCount: this.segments.size,
      lastQuery: this.lastQuery.slice(0, 240),
      lastHits: this.lastHits,
      retrievedTokens: this.retrievedTokens,
    };
  }
}

export function extractContextPaths(text = '') {
  return extractPaths(text);
}
