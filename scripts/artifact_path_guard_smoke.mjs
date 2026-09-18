import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-guard-'));
const kimiHome = path.join(tmp, 'kimi');
fs.mkdirSync(kimiHome, { recursive: true });
fs.writeFileSync(path.join(kimiHome, 'lazydev-last-prompt.json'), JSON.stringify({ prompt: 'make a standalone html artifact', task: { artifact: true } }));
try {
  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'lazydev-path-guard.mjs')], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: '/root', tool_input: { path: 'lazydevfile/example.html', content: '<!doctype html>' } }),
    encoding: 'utf8',
    env: { ...process.env, KIMI_CODE_HOME: kimiHome, LAZYDEV_ARTIFACT_DIR: '/storage/emulated/0/lazydevfile' },
  });
  assert.equal(result.status, 2, `expected Write to be blocked, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /\/storage\/emulated\/0\/lazydevfile/);
  console.log('PASS: artifact path guard intercepts Kimi Write and forces the canonical artifact directory');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
