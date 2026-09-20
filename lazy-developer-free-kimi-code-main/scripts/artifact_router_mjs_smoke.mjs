import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-router-'));
const kimi = path.join(tmp, 'kimi');
const cwd = path.join(tmp, 'workspace');
const canonical = path.join(tmp, 'lazydevfile');
fs.mkdirSync(kimi, { recursive: true });
fs.mkdirSync(cwd, { recursive: true });
fs.writeFileSync(path.join(kimi, 'lazydev-last-prompt.json'), JSON.stringify({ prompt: 'buat website sejarah Indonesia' }));
const sourceDir = path.join(tmp, 'legacy', 'lazydevfile');
fs.mkdirSync(sourceDir, { recursive: true });
const source = path.join(sourceDir, 'sejarah.html');
fs.writeFileSync(source, '<html><body>1945</body></html>');
try {
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'lazydev-artifact-router.mjs')], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      cwd,
      tool_input: { path: source, content: '<html><body>1945</body></html>' },
    }),
    encoding: 'utf8',
    env: { ...process.env, KIMI_CODE_HOME: kimi, LAZYDEV_ARTIFACT_DIR: canonical },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(canonical, 'sejarah.html')), true);
  assert.equal(fs.existsSync(source), false);
  assert.match(result.stdout, /LazyDev artifact router/);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('PASS: MJS post-write artifact router relocates legacy lazydevfile paths without blocking the tool');
