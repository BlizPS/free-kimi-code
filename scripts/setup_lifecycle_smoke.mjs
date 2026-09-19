import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'scripts', 'lazydev.mjs');
const source = fs.readFileSync(entry, 'utf8');

assert.match(source, /import readline from 'node:readline';/);
assert.match(source, /const rl = readline\.createInterface\(\{[\s\S]*?input: process\.stdin/);
assert.match(source, /try \{ process\.stdin\.pause\(\); \} catch \{\}/);
assert.match(source, /process\.stdin\.setRawMode\(false\)/);
assert.match(source, /readline\.emitKeypressEvents\(process\.stdin\)/);
assert.match(source, /class InputInterruptedError extends Error/);
assert.match(source, /code = 'LAZYDEV_INPUT_INTERRUPTED'/);
assert.match(source, /if \(error\?\.code === 'LAZYDEV_INPUT_INTERRUPTED'\) return;/);
assert.match(source, /if \(error\?\.code === 'LAZYDEV_INPUT_INTERRUPTED'\) \{\s*process\.exitCode = 130;/);
assert.doesNotMatch(source, /reject\(new Error\('Input interrupted\.'\)\)/);

const child = spawnSync(process.execPath, [entry, 'setup'], {
  input: '99\n',
  encoding: 'utf8',
  timeout: 3000,
});
assert.equal(child.status, 0, child.stderr);
assert.match(child.stdout, /Provider \[1-10\]/);
assert.match(child.stdout, /Choose a provider number/);

console.log('setup lifecycle smoke: PASS');
