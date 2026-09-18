import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'scripts', 'lazydev.mjs');
const source = fs.readFileSync(entry, 'utf8');

assert.match(source, /if \(!cmd\) return help\(\);/);
assert.doesNotMatch(source, /if \(!ensureKimiInstalled\(\)\) \{ await launchConfiguredCli\(\); return; \}/);

const bare = spawnSync(process.execPath, [entry], { encoding: 'utf8' });
assert.equal(bare.status, 0, bare.stderr);
assert.match(bare.stdout, /lazydev chat/);
assert.match(bare.stdout, /Command center/);
assert.doesNotMatch(bare.stdout, /Open the configured or detected agent CLI/);

console.log('command router smoke: PASS');
