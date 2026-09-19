import { estimateTokens } from '../token/index.mjs';

const DEFAULT_KEEP_KINDS = new Set(['constraint', 'decision', 'evidence', 'changed', 'risk']);

function score(block, query = '') {
  const text = String(block?.text ?? block ?? '');
  const terms = new Set(String(query).toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
  const body = new Set(text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean));
  let hits = 0;
  for (const term of terms) if (body.has(term)) hits += 1;
  const lexical = terms.size ? hits / terms.size : 0;
  const priority = block?.pinned ? 4 : DEFAULT_KEEP_KINDS.has(block?.kind) ? 2 : 0;
  const recent = Math.max(0, Number(block?.recency || 0));
  return priority + lexical * 3 + recent;
}

export function pruneContext(blocks = [], options = {}) {
  const budget = Math.max(1, Number(options.tokenBudget) || 1);
  const ranked = [...blocks]
    .map((block, index) => ({ block, index, cost: estimateTokens(block?.text ?? block), score: score(block, options.query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [];
  let used = 0;
  for (const item of ranked) {
    if (used + item.cost > budget && selected.length) continue;
    selected.push(item.block);
    used += item.cost;
  }
  return { blocks: selected, estimatedTokens: used, budget };
}

export function compactEvidence(text, maxChars = 1200) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 24)).trimEnd()} …[truncated]`;
}
