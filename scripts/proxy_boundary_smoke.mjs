import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'agents', 'lazydev.md'), 'utf8');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'runtime', 'token-policy.json'), 'utf8'));

// scripts/lazydev.mjs is intentionally only a thin compatibility wrapper now;
// cli/lazydev.py owns the canonical chat/runtime implementation.
assert.match(launcher, /function runNativeCommand\(subcommand = 'chat'\)/);
assert.match(launcher, /path\.join\(root, 'cli', 'lazydev\.py'\)/);
assert.match(launcher, /spawnSync\(command, args/);
assert.match(launcher, /return runNativeCommand\('chat'\);/);
assert.doesNotMatch(launcher, /['"]--config-file['"]/);

// Canonical runtime keeps Kimi's established workspace/proxy boundaries.
assert.match(runtime, /ARTIFACT_DIR = Path\(_PLATFORM_PATHS\["artifactDirectory"\]\)/);
assert.match(runtime, /args = \["--add-dir", str\(ARTIFACT_DIR\)\]/);
assert.doesNotMatch(runtime, /args\s*=\s*\[[^\n]*['"]--work-dir['"]/);
assert.match(runtime, /KIMI_LOOP_MAX_STEPS_PER_TURN/);
assert.match(runtime, /max_steps_per_turn = 0/);
assert.equal(policy.max_steps_per_turn, 0);
assert.match(agent, /Treat any activated or clearly relevant LazyDev Skill as execution policy/);
assert.match(agent, /LazyDev owns provider\/model routing\. Native Kimi `\/login` and `\/logout` are allowed/);

// Kimi-only auth/config internals stay in the canonical Python runtime rather than
// being duplicated by the Node compatibility wrapper.
for (const needle of [
  'KIMI_CODE_HOME',
  'KIMI_MODEL_MAX_CONTEXT_SIZE',
  'write_kimi_mcp_config',
]) assert.ok(runtime.includes(needle), `canonical runtime missing ${needle}`);
assert.ok(launcher.includes('runNativeCommand'), 'compat wrapper must expose native chat delegation');

console.log('proxy boundary smoke: PASS');

assert.ok(runtime.includes('env[\"KIMI_MODEL_NAME\"]'), 'missing Kimi model env override');
assert.ok(runtime.includes('env[\"KIMI_MODEL_MAX_CONTEXT_SIZE\"]'), 'missing Kimi context env guard');
assert.ok(runtime.includes('if provider[\"id\"] == \"ninerouter\"'), '9Router-specific thinking/model compatibility branch missing');
console.log('PASS: canonical Python runtime owns model/context boundary and preserves 9Router compatibility');
