#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressContext, readEfficiencyPolicy } from '../runtime/lazy-token-efficiency.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredSkills = ['lazy-developer', 'lazy-debug', 'lazy-review', 'lazy-test'];
const policy = readEfficiencyPolicy();
assert.match(policy, /ACTIVE BY DEFAULT/);
assert.match(policy, /~75%/);
for (const skill of requiredSkills) {
  const text = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
  assert.match(text, /75%/);
  assert.match(text, /Anti-yap|Lead with findings/);
}
const sample = 'Sure, I would be happy to explain. The component is actually re-rendering because you can create a new object reference on every render. Do not change `useMemo` or https://example.com/docs. The fix is to wrap the object in `useMemo`.';
const out = compressContext(sample);
assert.ok(out.after < out.before, 'sample context should shrink');
assert.match(out.compressed, /`useMemo`/);
assert.match(out.compressed, /https:\/\/example\.com\/docs/);
assert.match(out.compressed, /not|never|no|only|except/i);
console.log(`PASS: lazy efficiency policy active; sample context ${out.before} -> ${out.after} bytes (${Math.round(out.ratio*100)}% shorter)`);
