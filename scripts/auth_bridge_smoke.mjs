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
const fakeKimi = path.join(bin, 'kimi');
fs.writeFileSync(fakeKimi, `#!/bin/sh
printf '%s\\n' "$*" > "${argsFile}"
printf '%s\\n' "$KIMI_MODEL_NAME|$KIMI_MODEL_PROVIDER_TYPE|$KIMI_MODEL_BASE_URL" > "${envFile}"
# Simulate native /logout removing LazyDev's provider/model/default.
cat > "$KIMI_CODE_HOME/config.toml" <<'EOF'
default_model = ""
[providers."managed:kimi-code"]
type = "kimi"
oauth = { storage = "keyring", key = "kimi-code-oauth" }
[models."kimi-code/k3"]
provider = "managed:kimi-code"
model = "k3"
max_context_size = 262144
EOF
sleep 0.85
exit 0
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
  PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`,
  TERMUX_VERSION: '',
  PREFIX: '',
};
try {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'lazydev.mjs'), 'chat'], { env, cwd: home, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cfg = fs.readFileSync(path.join(xdg, 'lazydev', 'kimi-code', 'config.toml'), 'utf8');
  assert.match(cfg, /default_model = "lazydev\/openrouter\/free"/);
  assert.match(cfg, /\[providers\.lazydev\]/);
  assert.match(cfg, /\[providers\."managed:kimi-code"\]/);
  assert.match(cfg, /\[models\.\"kimi-code\/k3\"\]/);
  assert.match(cfg, /max_steps_per_turn = 0/);
  const modelEnv = fs.readFileSync(envFile, 'utf8').trim();
  assert.match(modelEnv, /^openrouter\/free\|openai\|http:\/\/127\.0\.0\.1:\d+\/v1$/);
  assert.doesNotMatch(fs.readFileSync(argsFile, 'utf8'), /--config-file/);
  console.log('auth bridge smoke: PASS');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
