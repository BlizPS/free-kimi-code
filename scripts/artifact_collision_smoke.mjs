import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nextAvailableArtifactName } from '../runtime/artifact-naming.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-artifacts-'));
const home = path.join(dir, 'kimi-home');
fs.mkdirSync(home, { recursive: true });
const guard = path.resolve(new URL('../hooks/lazydev-path-guard.mjs', import.meta.url).pathname);
const existing = path.join(dir, 'report.html');
const existingZip = path.join(dir, 'archive.zip');
fs.writeFileSync(existing, 'OLD HTML');
fs.writeFileSync(path.join(dir, 'report1.html'), 'OLD HTML 1');
fs.writeFileSync(path.join(dir, 'report2.html'), 'OLD HTML 2');
fs.writeFileSync(existingZip, 'OLD ZIP');
fs.writeFileSync(path.join(home, 'lazydev-last-prompt.json'), JSON.stringify({ prompt: 'create a standalone artifact', task: { artifact: true } }));

try {
  assert.equal(nextAvailableArtifactName(dir, 'report.html'), 'report3.html');
  assert.equal(nextAvailableArtifactName(dir, 'archive.zip'), 'archive1.zip');
  assert.equal(nextAvailableArtifactName(dir, 'script.ahk'), 'script.ahk');
  assert.equal(nextAvailableArtifactName(dir, 'fresh.html'), 'fresh.html');

  const env = { ...process.env, KIMI_CODE_HOME: home, LAZYDEV_ARTIFACT_DIR: dir };
  const result = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      cwd: '/tmp',
      tool_input: { path: existing, content: 'NEW HTML' },
    }),
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 2, `expected collision Write to be blocked: ${result.stderr}`);
  assert.match(result.stderr, /report3\.html/u);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'OLD HTML');

  const legacy = spawnSync(process.execPath, [guard], {
    input: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'WriteFile',
      cwd: '/tmp',
      tool_input: { path: existingZip, content: 'NEW ZIP' },
    }),
    encoding: 'utf8',
    env,
  });
  assert.equal(legacy.status, 2, `expected legacy collision WriteFile to be blocked: ${legacy.stderr}`);
  assert.match(legacy.stderr, /archive1\.zip/u);
  assert.equal(fs.readFileSync(existingZip, 'utf8'), 'OLD ZIP');

  console.log('PASS: standalone artifact collisions are blocked before Write and preserve every existing file');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
