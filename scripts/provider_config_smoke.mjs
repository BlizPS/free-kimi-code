#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lazydev = path.join(root, 'scripts', 'lazydev.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-provider-'));
const home = path.join(temp, 'home');
const xdg = path.join(temp, 'xdg');
const kimiBin = path.join(home, '.local', 'bin');
const configDir = path.join(xdg, 'lazydev');
fs.mkdirSync(kimiBin, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
const captured = path.join(temp, 'captured-config.toml');
const capturedEnv = path.join(temp, 'captured-env.json');
const fakeKimi = path.join(kimiBin, 'kimi');
fs.writeFileSync(fakeKimi, `#!/bin/sh\ncp "$KIMI_CODE_HOME/config.toml" "${captured}"\nprintf '%s' "$OPENAI_BASE_URL" > "${capturedEnv}"\nexit 0\n`);
fs.chmodSync(fakeKimi, 0o755);
fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
  activeProvider: 'openai',
  providers: { openai: { apiKey: 'test-key', model: 'gpt-test', modelInfo: { contextLimit: 128000, outputLimit: 8192 } } },
}, null, 2));

const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: xdg,
  PATH: `${kimiBin}${path.delimiter}${process.env.PATH || ''}`,
  OPENAI_BASE_URL: 'not-a-url',
  OPENAI_API_KEY: 'stale-key',
  TERMUX_VERSION: '',
  PREFIX: '',
};
const result = spawnSync(process.execPath, [lazydev, 'chat'], { env, encoding: 'utf8', timeout: 20000 });
assert.equal(result.status, 0, `chat smoke failed: ${result.stderr || result.stdout}`);
assert.ok(fs.existsSync(captured), 'Kimi config was not generated');
const config = fs.readFileSync(captured, 'utf8');
assert.ok(config.includes('base_url = "http://127.0.0.1:'), config);
assert.ok(config.includes('provider = "lazydev"'), config);
assert.ok(config.includes('max_attempts_per_step = 10'), config);
assert.equal((config.match(/\[loop_control\]/g) || []).length, 1, config);

assert.doesNotMatch(config, /undefined/);
assert.equal(fs.readFileSync(capturedEnv, 'utf8'), '', 'stale OPENAI_BASE_URL leaked into Kimi environment');
assert.match(config, /\[providers\.lazydev\][\s\S]*base_url = "http:\/\/127\.0\.0\.1:/);
console.log('provider config smoke: PASS');
