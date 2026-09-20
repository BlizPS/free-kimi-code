import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
assert.match(runtime, /args = \["--add-dir", str\(ARTIFACT_DIR\)\]/);
assert.match(runtime, /ARTIFACT_DIR = Path\(_PLATFORM_PATHS\["artifactDirectory"\]\)/);
assert.match(launcher, /path\.join\(root, 'cli', 'lazydev\.py'\)/);
console.log('workspace add-dir smoke: PASS');
