const DEFAULT_TOKEN_DIVISOR = 4;
const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','how','in','is','it','of','on','or','that','the','this','to','was','what','when','where','which','who','why','with'
]);

function tokens(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function lexicalScore(query, text) {
  const q = new Set(tokens(query));
  if (!q.size) return 0;
  const body = tokens(text);
  if (!body.length) return 0;
  let hits = 0;
  for (const term of q) if (body.includes(term)) hits++;
  return hits / q.size;
}

export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / DEFAULT_TOKEN_DIVISOR);
}

export function normalizeContext(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function dedupeContextBlocks(blocks = []) {
  const seen = new Set();
  const out = [];
  for (const block of blocks) {
    const text = String(block?.text ?? block ?? '');
    const key = normalizeContext(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...(typeof block === 'object' ? block : {}), text });
  }
  return out;
}

export function selectContextBlocks(blocks = [], options = {}) {
  const query = String(options.query || '');
  const budget = Math.max(1, Number(options.tokenBudget) || 1);
  const candidates = dedupeContextBlocks(blocks).map((block, index) => ({
    block,
    index,
    pinned: Boolean(block.pinned),
    recent: Number(block.recency || 0),
    relevance: lexicalScore(query, block.text),
    cost: estimateTokens(block.text),
  }));

  candidates.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const as = a.relevance * 3 + a.recent;
    const bs = b.relevance * 3 + b.recent;
    if (as !== bs) return bs - as;
    return a.index - b.index;
  });

  const selected = [];
  let used = 0;
  for (const item of candidates) {
    if (selected.length > 0 && used + item.cost > budget) continue;
    if (used + item.cost > budget && !item.pinned) continue;
    selected.push(item.block);
    used += item.cost;
  }
  return { blocks: selected, estimatedTokens: used, budget };
}

export function buildTokenEconomyFrame(stats = {}) {
  const parts = [
    '[TOKEN] progressive-disclosure',
    `budget=${Math.max(0, Number(stats.budget) || 0)}`,
    `used=${Math.max(0, Number(stats.used) || 0)}`,
    'preserve=code,paths,urls,identifiers,versions,errors,negation,order',
    'drop=duplicate,stale,pleasantry,filler',
  ];
  return parts.join('; ');
}
