const SESSION_MODEL_RE = /\blazydev\/[A-Za-z0-9][A-Za-z0-9._:@+/?=-]*/g;

export function extractSessionModelAliases(texts, currentAlias = '') {
  const aliases = new Set();
  const current = String(currentAlias || '').trim();
  for (const source of Array.isArray(texts) ? texts : []) {
    const text = typeof source === 'string' ? source : '';
    for (const match of text.matchAll(SESSION_MODEL_RE)) {
      const alias = match[0];
      if (alias && alias !== current) aliases.add(alias);
      if (aliases.size >= 128) break;
    }
    if (aliases.size >= 128) break;
  }
  return [...aliases].slice(0, 128);
}
