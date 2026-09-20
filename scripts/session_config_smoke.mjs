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
assert.match(runtime, /if cmd == "resume":\s*return chat\(resume=True\)/);
assert.doesNotMatch(runtime, /if cmd == "sessions":/);
assert.match(runtime, /return _launch_codex\([\s\S]*?resume=resume/);
assert.match(runtime, /args = base_args \+ \(\['resume'\] if resume else \[\]\)/);
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
const bin = path.join(tmp, 'bin');
const xdg = path.join(tmp, 'xdg');
const home = path.join(tmp, 'home');
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(path.join(xdg, 'lazydev', 'kimi-code', 'sessions', 'old'), { recursive: true });
fs.writeFileSync(path.join(bin, 'kimi'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$LAZYDEV_TEST_ARGS"\n', { mode: 0o700 });
fs.writeFileSync(path.join(xdg, 'lazydev', 'config.json'), JSON.stringify({
  activeProvider: 'gemini',
  providers: { gemini: { apiKey: 'test-key', model: 'gemini-3.5-flash-lite', modelInfo: { contextLimit: 1048576, inputLimit: 1048576, outputLimit: 65536 } } },
}));
fs.writeFileSync(path.join(xdg, 'lazydev', 'kimi-code', 'sessions', 'old', 'context.jsonl'), '{"model":"lazydev/gemini-3.8-flash-medium"}\n');
fs.writeFileSync(path.join(xdg, 'lazydev', 'kimi-code', 'sessions', 'old', 'state.json'), '{"model":"lazydev/gemini-3.5-flash"}\n');
const argsFile = path.join(tmp, 'args');
try {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'lazydev.mjs'), 'chat'], {
    cwd: home,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      PATH: `${bin}:${process.env.PATH || ''}`,
      LAZYDEV_TEST_ARGS: argsFile,
    },
    timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const kimiHome = path.join(xdg, 'lazydev', 'kimi-code');
  const config = fs.readFileSync(path.join(kimiHome, 'config.toml'), 'utf8');
  assert.match(config, /default_model = "lazydev\/gemini-3\.5-flash-lite"/);
  assert.match(config, /\[models\."lazydev\/gemini-3.8-flash-medium"\][\s\S]*model = "gemini-3\.5-flash-lite"/);
  assert.match(config, /\[models\."lazydev\/gemini-3\.5-flash"\][\s\S]*model = "gemini-3\.5-flash-lite"/);
  assert.match(config, /matcher = "Write\|WriteFile\|StrReplaceFile"/);
  assert.match(config, /\[mcp\.client\]/);
  const mcp = JSON.parse(fs.readFileSync(path.join(kimiHome, 'mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers['lazydev-search'].args.at(-1), path.join(root, 'runtime', 'browser-mcp.py'));
  assert.equal(mcp.mcpServers['lazydev-search'].toolTimeoutMs, 60000);
  assert.equal(mcp.mcpServers['lazydev-search'].startupTimeoutMs, 30000);
  const args = fs.readFileSync(argsFile, 'utf8');
  assert.doesNotMatch(args, /--config-file/);
  assert.match(args, /--add-dir/);
  assert.doesNotMatch(args, /--mcp-config-file/);
  assert.match(config, /max_steps_per_turn = 0/);
  console.log('PASS: launch-time config remaps old session models, preserves session files, exposes artifact path, loads search MCP, and supports unified resume routing');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
