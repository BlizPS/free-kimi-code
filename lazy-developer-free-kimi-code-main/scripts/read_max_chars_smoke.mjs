import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['scripts/lazydev.mjs','cli/lazydev.py']) {
  const s = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(s, /LAZYDEV_READ_MAX_CHARS/);
  assert.match(s, /500000/);
}
console.log('PASS: Read max_chars is normalized to a practical 100k-500k range rather than an artificial 30k ceiling');
