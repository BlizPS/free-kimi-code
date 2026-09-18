import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-auth-routing-'));
const bin = path.join(tmp, 'bin');
const xdg = path.join(tmp, 'xdg');
const home = path.join(tmp, 'home');
const capture = path.join(tmp, 'capture.json');
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(path.join(xdg, 'lazydev'), { recursive: true });

// Emulate the config mutation performed by native /login. The important
// invariant is that KIMI_MODEL_* still pins the effective inference route.
const fake = path.join(bin, 'kimi');
const fakeScript = String.raw`#!/bin/sh
node - <<'NODE'
const fs = require('fs');
const p = process.env.KIMI_CODE_HOME + '/config.toml';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/^default_model = .*$/m, 'default_model = "kimi-code/k2p5"');
s += '\n[providers.kimi_code]\ntype = "kimi"\n';
s += '\n[models."kimi-code/k2p5"]\nprovider = "kimi_code"\nmodel = "k2p5"\n';
fs.writeFileSync(p, s);
const out = {
  model: process.env.KIMI_MODEL_NAME,
  apiKey: process.env.KIMI_MODEL_API_KEY,
  providerType: process.env.KIMI_MODEL_PROVIDER_TYPE,
  baseUrl: process.env.KIMI_MODEL_BASE_URL,
  displayName: process.env.KIMI_MODEL_DISPLAY_NAME,
  maxContext: process.env.KIMI_MODEL_MAX_CONTEXT_SIZE,
  args: process.argv.slice(1),
  configAfterLogin: fs.readFileSync(p, 'utf8')
};
fs.writeFileSync(process.env.LAZYDEV_AUTH_CAPTURE, JSON.stringify(out, null, 2));
NODE
exit 0
`;
fs.writeFileSync(fake, fakeScript, { mode: 0o700 });

fs.writeFileSync(path.join(xdg, 'lazydev', 'config.json'), JSON.stringify({
  activeProvider: 'nvidia',
  providers: {
    nvidia: {
      apiKey: 'provider-secret',
      model: 'nvidia/test-model',
      modelInfo: { contextLimit: 131072, inputLimit: 131072, outputLimit: 8192 }
    }
  }
}));

try {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'lazydev.mjs'), 'chat'], {
    cwd: home,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: xdg,
      PATH: `${bin}:${process.env.PATH || ''}`,
      LAZYDEV_AUTH_CAPTURE: capture,
    },
    timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const data = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(data.model, 'nvidia/test-model');
  assert.equal(data.providerType, 'openai');
  assert.match(data.baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/v1$/);
  assert.equal(data.displayName, 'NVIDIA · nvidia/test-model');
  assert.ok(Number(data.maxContext) >= 32768);
  assert.ok(data.apiKey && data.apiKey.length >= 32, 'proxy token must be present');
  assert.match(data.configAfterLogin, /default_model = "kimi-code\/k2p5"/);
  assert.ok(!data.args.includes('--config-file'));
  assert.ok(!data.args.includes('--mcp-config-file'));
  console.log('auth routing smoke: PASS — native login/logout config mutations cannot replace the LazyDev inference route');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
