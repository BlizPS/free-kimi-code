import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-auth-bridge-'));
const bin = path.join(tmp, 'bin');
const xdg = path.join(tmp, 'xdg');
const home = path.join(tmp, 'home');
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(home, { recursive: true });
const argsFile = path.join(tmp, 'args');
const envFile = path.join(tmp, 'env.json');
const fakeKimi = path.join(home, '.kimi-code', 'bin', 'kimi');
fs.mkdirSync(path.dirname(fakeKimi), { recursive: true });
fs.symlinkSync(process.execPath, path.join(bin, 'node'));
fs.symlinkSync('/opt/pyvenv/bin/python3', path.join(bin, 'python3'));
fs.writeFileSync(fakeKimi, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(${JSON.stringify(argsFile)}, process.argv.slice(2).join(' ') + '\\n');
fs.writeFileSync(${JSON.stringify(envFile)}, [process.env.KIMI_MODEL_NAME, process.env.KIMI_MODEL_PROVIDER_TYPE, process.env.KIMI_MODEL_BASE_URL].join('|') + '\\n');
// Simulate native /logout removing LazyDev's route from Kimi's config.
fs.mkdirSync(process.env.KIMI_CODE_HOME, { recursive: true });
fs.writeFileSync(path.join(process.env.KIMI_CODE_HOME, 'config.toml'), [
  'default_model = ""',
  '[providers."managed:kimi-code"]',
  'type = "kimi"',
  'oauth = { storage = "keyring", key = "kimi-code-oauth" }',
  '[models."kimi-code/k3"]',
  'provider = "managed:kimi-code"',
  'model = "k3"',
  'max_context_size = 262144',
  '',
].join('\\n'));
`, { mode: 0o700 });
fs.mkdirSync(path.join(xdg, 'lazydev'), { recursive: true });
fs.writeFileSync(path.join(xdg, 'lazydev', 'config.json'), JSON.stringify({
  activeProvider: 'openrouter',
  providers: {
    openrouter: {
      apiKey: 'test-key',
      model: 'openrouter/free',
      modelInfo: { contextLimit: 131072, inputLimit: 131072, outputLimit: 8192 },
    },
  },
}));
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: xdg,
  PATH: bin,
  TERMUX_VERSION: '',
  PREFIX: '',
};
try {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'lazydev.mjs'), 'chat'], {
    env,
    cwd: home,
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = path.join(xdg, 'lazydev', 'kimi-code', 'config.toml');
  const cfg = fs.readFileSync(generated, 'utf8');
  assert.match(cfg, /default_model = ""/);
  assert.match(cfg, /\[providers\."managed:kimi-code"\]/);
  const modelEnv = fs.readFileSync(envFile, 'utf8').trim();
  assert.match(modelEnv, /^openrouter\/free\|openai\|http:\/\/127\.0\.0\.1:\d+\/v1$/);
  assert.doesNotMatch(fs.readFileSync(argsFile, 'utf8'), /--config-file/);

  // Exercise the auth bridge itself without depending on the timing of an
  // interactive child process: mutate Kimi's config and wait for restoration.
  const bridgeScript = `
import time
from pathlib import Path
from cli import lazydev

cfg = lazydev.read_config()
provider = lazydev.active_provider(cfg)
config_path = lazydev.KIMI_HOME / 'config.toml'
stop = lazydev._start_kimi_auth_bridge(config_path, provider, cfg, None)
try:
    config_path.write_text('''default_model = ""\n[providers."managed:kimi-code"]\ntype = "kimi"\n''', encoding='utf-8')
    deadline = time.time() + 3
    while time.time() < deadline:
        text = config_path.read_text(encoding='utf-8')
        if 'default_model = "lazydev/openrouter/free"' in text and '[providers.lazydev]' in text and '[providers."managed:kimi-code"]' in text:
            break
        time.sleep(0.05)
    else:
        raise SystemExit('auth bridge did not restore LazyDev routing')
finally:
    lazydev._stop_kimi_auth_bridge(stop)
`;
  const bridge = spawnSync('/opt/pyvenv/bin/python3', ['-c', bridgeScript], {
    env: { ...env, PYTHONPATH: root },
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(bridge.status, 0, bridge.stderr || bridge.stdout);
  console.log('auth bridge smoke: PASS');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
