import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'agents', 'lazydev.md'), 'utf8');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'token-policy.json'), 'utf8'));

assert.ok(launcher.includes("const launchArgs = [...invocation.args, '--add-dir', outputDirectory()];"));
assert.match(launcher, /else launchArgs\.push\('--agent', 'default'\);/);
assert.match(launcher, /KIMI_LOOP_MAX_STEPS_PER_TURN: '0'/);
assert.match(launcher, /`max_steps_per_turn = 0`,/);
assert.equal(policy.max_steps_per_turn, 0);
assert.match(agent, /Treat any activated or clearly relevant LazyDev Skill as execution policy/);
assert.match(agent, /Authentication and provider configuration are managed by LazyDev/);
assert.ok(!launcher.includes('--config-file'), 'launcher must not reference the removed legacy config-file option');
assert.match(launcher, /KIMI_CODE_HOME: kimiHome\(\)/);

console.log('proxy boundary smoke: PASS');
