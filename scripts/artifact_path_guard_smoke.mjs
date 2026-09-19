import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { promises as fsp } from 'node:fs';

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
  assert.equal(result.status, 0, `legacy path should be recoverable, got ${result.status}: ${result.stderr}`);
  assert.equal(result.stderr, '');
  console.log('PASS: artifact path guard allows recoverable paths; post-write router owns relocation');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
