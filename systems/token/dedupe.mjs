import { fingerprint } from '../context/fingerprint.mjs';

export function canonicalCall(name, args = {}) {
  return fingerprint({ name: String(name || ''), args: normalize(args) });
}

export function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)]));
}

export function dedupeCalls(calls = []) {
  const seen = new Set();
  return calls.filter((call) => {
    const key = canonicalCall(call?.name, call?.args);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shouldSkipDuplicate(previous, name, args) {
  return Boolean(previous && previous === canonicalCall(name, args));
}
