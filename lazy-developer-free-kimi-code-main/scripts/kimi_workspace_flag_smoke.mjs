import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');

assert.doesNotMatch(python, /['\"]--work-dir['\"]/);
assert.doesNotMatch(launcher, /['\"]--work-dir['\"]/);
assert.match(python, /subprocess\.call\(\[kimi, \*args\], cwd=str\(workspace\)/);
assert.match(launcher, /spawn\(invocation\.command, launchArgs, \{[\s\S]*?cwd: workspaceDir/);
assert.match(python, /args = \[\"--add-dir\", str\(ARTIFACT_DIR\)\]/);
assert.match(launcher, /const launchArgs = \[\.\.\.invocation\.args, '--add-dir', artifactDir\];/);
console.log('kimi workspace flag smoke: PASS');
