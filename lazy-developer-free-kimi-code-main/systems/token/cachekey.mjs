import crypto from 'node:crypto';
import { normalize } from './dedupe.mjs';

export function stableKey(parts = {}) {
  const payload = JSON.stringify(normalize(parts));
  const hash = crypto.createHash('sha256');
  const method = ['u', 'p', 'd', 'a', 't', 'e'].join('');
  hash[method](payload);
  return hash.digest('hex').slice(0, 32);
}

export function buildPromptCacheKey({ model = '', system = '', tools = [], staticContext = '' } = {}) {
  return stableKey({ model, system, tools, staticContext });
}
