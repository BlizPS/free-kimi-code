const SESSION_MODEL_RE = /\blazydev\/[A-Za-z0-9][A-Za-z0-9._:@+/?=-]*/g;
const MODEL_FIELD_RE = /["'](?:model|model_id|modelAlias|model_alias)["']\s*[:=]\s*["']([^"'\r\n]+)["']/gi;
const PLAIN_MODEL_FIELD_RE = /(?:^|[,\s])model\s*=\s*["']?([A-Za-z0-9][A-Za-z0-9._:@+/?=-]{1,240})["']?/gim;

function normalizeAlias(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'primary' || raw === 'default') return '';
  if (raw.startsWith('lazydev/')) return raw;
  // Session records can store the upstream model ID without the LazyDev alias.
  // Rehydrate it as a LazyDev alias so Kimi can resolve an old session after the
  // user switches provider/model without editing the session files themselves.
  if (/^[A-Za-z0-9][A-Za-z0-9._:@+/?=-]{1,240}$/.test(raw)) return `lazydev/${raw}`;
  return '';
}

export function extractSessionModelAliases(texts, currentAlias = '') {
  const aliases = new Set();
  const current = String(currentAlias || '').trim();
  const add = (value) => {
    const alias = normalizeAlias(value);
    if (alias && alias !== current) aliases.add(alias);
  };
  for (const source of Array.isArray(texts) ? texts : []) {
    const text = typeof source === 'string' ? source : '';
    for (const match of text.matchAll(SESSION_MODEL_RE)) add(match[0]);
    for (const match of text.matchAll(MODEL_FIELD_RE)) add(match[1]);
    for (const match of text.matchAll(PLAIN_MODEL_FIELD_RE)) add(match[1]);
    if (aliases.size >= 256) break;
  }
  return [...aliases].slice(0, 256);
}
