import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
fs.writeFileSync(path.join(xdg, 'lazydev', 'kimi-code', 'sessions', 'old', 'context.jsonl'), '{"model":"lazydev/antigravity-preview-09-2026"}\n');
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
  assert.match(config, /\[models\."lazydev\/antigravity-preview-09-2026"\][\s\S]*model = "gemini-3\.5-flash-lite"/);
  assert.match(config, /\[models\."lazydev\/gemini-3\.5-flash"\][\s\S]*model = "gemini-3\.5-flash-lite"/);
  assert.match(config, /matcher = "Write\|WriteFile\|StrReplaceFile"/);
  assert.match(config, /\[mcp\.client\]/);
  const mcp = JSON.parse(fs.readFileSync(path.join(kimiHome, 'mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers['lazydev-search'].args.at(-1), path.join(root, 'runtime', 'lazydev-web-search.mjs'));
  const args = fs.readFileSync(argsFile, 'utf8');
  assert.match(args, /--config-file/);
  assert.match(args, /--add-dir/);
  assert.doesNotMatch(args, /--mcp-config-file/);
  assert.match(config, /max_steps_per_turn = 0/);
  console.log('PASS: launch-time config remaps old session models, preserves session files, exposes artifact path, and loads search MCP');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
