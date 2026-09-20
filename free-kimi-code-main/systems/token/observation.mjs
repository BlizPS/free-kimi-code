import { compactText } from './compaction.mjs';

const DUP_MARKER = /^(?:[>|-]\s*){0,2}(.*?)$/;

export function collapseRepeatedLines(text, maxCopies = 1) {
  const seen = new Map();
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const key = line.trim().toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (!key || count <= maxCopies || /\b(error|warning|failed)\b/i.test(line)) out.push(line);
  }
  return out.join('\n');
}

export function compactToolResult(result, options = {}) {
  const maxChars = Math.max(160, Number(options.maxChars) || 6000);
  const text = typeof result === 'string' ? result : JSON.stringify(result ?? '');
  if (text.length <= maxChars) return text;
  const cleaned = collapseRepeatedLines(text, 1);
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.55);
  const tail = maxChars - head - 40;
  const compact = compactText(cleaned, Math.floor(maxChars / 4));
  return `${compact.slice(0, head)}\n…[tool-result-compacted]…\n${compact.slice(-Math.max(80, tail))}`;
}

export function selectHighSignalLines(text, query = '', limit = 24) {
  const terms = new Set(String(query).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
  const scored = String(text ?? '').split(/\r?\n/).map((line, index) => {
    const lower = line.toLowerCase();
    const hits = [...terms].filter((term) => lower.includes(term)).length;
    const signal = /\b(error|failed|warning|changed|todo|fix|pass|test|http|exception)\b/i.test(line) ? 2 : 0;
    return { line, index, score: hits * 3 + signal };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, Math.max(1, limit)).sort((a, b) => a.index - b.index).map((item) => item.line).join('\n');
}

export function compactObservation(text, query = '') {
  const focused = query ? selectHighSignalLines(text, query) : text;
  return compactToolResult(focused, { maxChars: 6000 });
}
