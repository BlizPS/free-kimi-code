import { fingerprint } from '../context/fingerprint.mjs';

export class EvidenceCache {
  constructor({ ttlMs = 15 * 60 * 1000, maxEntries = 64 } = {}) {
    this.ttlMs = Math.max(1000, Number(ttlMs) || 900000);
    this.maxEntries = Math.max(1, Number(maxEntries) || 64);
    this.store = new Map();
  }

  key(query) {
    return fingerprint(String(query || '').trim().toLowerCase());
  }

  get(query, now = Date.now()) {
    const key = this.key(query);
    const entry = this.store.get(key);
    if (!entry || now - entry.createdAt > this.ttlMs) {
      if (entry) this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(query, value, now = Date.now()) {
    const key = this.key(query);
    this.store.set(key, { createdAt: now, value });
    while (this.store.size > this.maxEntries) this.store.delete(this.store.keys().next().value);
    return value;
  }

  clear() {
    this.store.clear();
  }
}
