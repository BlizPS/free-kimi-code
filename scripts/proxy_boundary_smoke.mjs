import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'agents', 'lazydev.md'), 'utf8');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'token-policy.json'), 'utf8'));

assert.match(launcher, /const artifactDir = ensureOutputDirectory\(\);[\s\S]*const workspaceDir = path\.resolve\(process\.cwd\(\)\);[\s\S]*const launchArgs = \[\.\.\.invocation\.args, '--add-dir', artifactDir\];/);
assert.doesNotMatch(launcher, /['"]--work-dir['"]/);
assert.match(launcher, /Kimi Code derives its workspace from the child process cwd/);
assert.match(launcher, /else launchArgs\.push\('--agent', 'default'\);/);
assert.match(launcher, /KIMI_LOOP_MAX_STEPS_PER_TURN: '0'/);
assert.match(launcher, /`max_steps_per_turn = 0`,/);
assert.equal(policy.max_steps_per_turn, 0);
assert.match(agent, /Treat any activated or clearly relevant LazyDev Skill as execution policy/);
assert.match(agent, /LazyDev owns provider\/model routing\. Native Kimi `\/login` and `\/logout` are allowed/);
assert.ok(!launcher.includes('--config-file'), 'launcher must not reference the removed legacy config-file option');
assert.match(launcher, /KIMI_CODE_HOME: kimiHome\(\)/);
assert.match(launcher, /KIMI_MODEL_NAME = String\(pc\.model\)/);
assert.match(launcher, /startKimiAuthBridge/);
assert.match(launcher, /composeLazyDevConfig/);
assert.doesNotMatch(launcher, /Do not invoke account login, logout/);

console.log('proxy boundary smoke: PASS');

const directEnvGuard = launcher.match(/const modelEnv = proxy \? buildKimiModelEnv\(provider, pc, proxy, budget\) : \{\};/);
assert.ok(directEnvGuard, 'direct providers must not receive runtime KIMI_MODEL overrides');
console.log('PASS: direct providers use config.toml instead of forced KIMI_MODEL_* runtime overrides');
