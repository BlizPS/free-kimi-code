import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextAvailableArtifactName } from '../runtime/artifact-naming.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-artifacts-'));
try {
  fs.writeFileSync(path.join(dir, 'report.html'), 'old');
  assert.equal(nextAvailableArtifactName(dir, 'report.html'), 'report1.html');
  fs.writeFileSync(path.join(dir, 'report1.html'), 'old');
  assert.equal(nextAvailableArtifactName(dir, 'report.html'), 'report2.html');
  fs.writeFileSync(path.join(dir, 'archive.zip'), 'old');
  assert.equal(nextAvailableArtifactName(dir, 'archive.zip'), 'archive1.zip');
  fs.writeFileSync(path.join(dir, 'script.ahk'), 'old');
  assert.equal(nextAvailableArtifactName(dir, 'script.ahk'), 'script1.ahk');
  assert.equal(nextAvailableArtifactName(dir, 'fresh.html'), 'fresh.html');
  console.log('PASS: artifact filename collision routing is deterministic and extension-safe');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
