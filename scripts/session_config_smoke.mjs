import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
assert.match(runtime, /if cmd == "resume":[\s\S]*?return chat\(resume=True\)/);
assert.doesNotMatch(runtime, /if cmd == "sessions":/);
assert.match(runtime, /return _launch_codex\([\s\S]*?resume=resume/);
assert.match(runtime, /args = \[\'resume\'\] if resume else \[\]/);
assert.doesNotMatch(runtime, /base_args=\[/);
assert.doesNotMatch(runtime, /['\"]--config['\"]/);
assert.match(runtime, /return _launch_with_initial_slash\(agy, args, ARTIFACT_DIR, env, '\/resume'\)/);
assert.match(runtime, /env\['LAZYDEV_CODEX_API_KEY'\]=token/);
assert.match(runtime, /env\['CODEX_API_KEY'\]=token/);
assert.match(runtime, /env\['OPENAI_API_KEY'\]=token/);
assert.match(runtime, /env\['OPENAI_BASE_URL'\]=f'http:\/\/127\.0\.0\.1:\{responses\.port\}\/v1'/);
assert.match(launcher, /if \(cmd === 'resume'\) return resume\(\);/);
assert.doesNotMatch(launcher, /if \(cmd === 'sessions'\)/);
assert.match(readme, /lazydev resume/);
assert.doesNotMatch(readme, new RegExp('lazydev ' + 'sessions'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-session-config-'));
try {
  const kimiHome = path.join(tmp, 'kimi-code');
  fs.mkdirSync(kimiHome, { recursive: true });
  const config = [
    'default_model = "lazydev/gemini-3.5-flash-lite"',
    '[models."lazydev/gemini-3.8-flash-medium"]',
    'model = "gemini-3.5-flash-lite"',
    '[models."lazydev/gemini-3.5-flash"]',
    'model = "gemini-3.5-flash-lite"',
    '[mcp.client]',
    'max_steps_per_turn = 0',
  ].join('\n');
  fs.writeFileSync(path.join(kimiHome, 'config.toml'), config + '\n');
  const mcp = {
    mcpServers: {
      'lazydev-search': { args: [path.join(root, 'runtime', 'browser-mcp.py')], toolTimeoutMs: 60000, startupTimeoutMs: 30000 },
      context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp@4.1.1'] },
    },
  };
  fs.writeFileSync(path.join(kimiHome, 'mcp.json'), JSON.stringify(mcp, null, 2));
  const parsed = JSON.parse(fs.readFileSync(path.join(kimiHome, 'mcp.json'), 'utf8'));
  assert.equal(parsed.mcpServers['lazydev-search'].args.at(-1), path.join(root, 'runtime', 'browser-mcp.py'));
  assert.equal(parsed.mcpServers['lazydev-search'].toolTimeoutMs, 60000);
  assert.deepEqual(parsed.mcpServers.context7.args, ['-y', '@upstash/context7-mcp@4.1.1']);
  assert.match(config, /default_model = "lazydev\/gemini-3\.5-flash-lite"/);
  assert.match(config, /max_steps_per_turn = 0/);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('PASS: launch-time config surface, MCP wiring, and unified resume routing are covered');
