import { fingerprint } from '../context/fingerprint.mjs';

export class ToolCallMemory {
  constructor({ maxEntries = 128 } = {}) {
    this.maxEntries = Math.max(8, Number(maxEntries) || 128);
    this.calls = new Map();
  }

  key(name, args) {
    return fingerprint({ name: String(name || ''), args: args ?? null });
  }

  seen(name, args) {
    return this.calls.has(this.key(name, args));
  }

  remember(name, args, result = {}) {
    const key = this.key(name, args);
    this.calls.set(key, { name, args, result, at: Date.now() });
    while (this.calls.size > this.maxEntries) this.calls.delete(this.calls.keys().next().value);
    return key;
  }

  clear() {
    this.calls.clear();
  }
}
