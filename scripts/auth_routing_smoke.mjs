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
const pythonProbe = spawnSync(
  process.platform === 'win32' ? 'where.exe' : 'which',
  ['python3'],
  { encoding: 'utf8' }
);
const python3 = (pythonProbe.stdout || '').split(/\r?\n/).find(Boolean);
if (!python3) throw new Error('python3 is required for auth routing smoke');

// Emulate a provider/account config mutation inside the child UI. The important
// invariant is that the LazyDev-selected model and loopback provider remain intact.
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
  model: process.env.LAZYDEV_MODEL,
  args: process.argv.slice(1),
  configAfterLogin: fs.readFileSync(p, 'utf8')
};
fs.writeFileSync(process.env.LAZYDEV_AUTH_CAPTURE, JSON.stringify(out, null, 2));
NODE
exit 0
`;
fs.writeFileSync(fake, fakeScript, { mode: 0o700 });
const nodeShim = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node');
const pythonShim = path.join(bin, process.platform === 'win32' ? 'python3.exe' : 'python3');
fs.symlinkSync(process.execPath, nodeShim);
fs.symlinkSync(python3, pythonShim);

fs.writeFileSync(path.join(xdg, 'lazydev', 'config.json'), JSON.stringify({
  // Use the local provider route so the smoke test is deterministic and never
  // depends on a live external provider catalog.
  activeProvider: 'ollama',
  providers: {
    ollama: {
      apiKey: '',
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
      PATH: `${bin}`,
      LAZYDEV_AUTH_CAPTURE: capture,
    },
    timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const data = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.equal(data.model, 'nvidia/test-model');
  assert.match(data.configAfterLogin, /\[providers\.lazydev\][\s\S]*base_url = \"http:\/\/127\.0\.0\.1:\d+\/v1\"/);
  assert.match(data.configAfterLogin, /\[providers\.lazydev\][\s\S]*api_key = \"[0-9a-f]{48}\"/);
  assert.match(data.configAfterLogin, /\[models\.\"lazydev\/nvidia\/test-model\"\]/);
  assert.match(data.configAfterLogin, /max_context_size = (?:32768|131072)/);
  assert.match(data.configAfterLogin, /max_output_size = 8192/);
  assert.match(data.configAfterLogin, /default_model = "kimi-code\/k2p5"/);
  assert.ok(!data.args.includes('--config-file'));
  assert.ok(!data.args.includes('--mcp-config-file'));
  console.log('auth routing smoke: PASS — native login/logout config mutations cannot replace the LazyDev inference route');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
