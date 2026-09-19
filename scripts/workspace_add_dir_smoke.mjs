import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const launchNeedle = "const artifactDir = ensureOutputDirectory();\n  const launchArgs = [...invocation.args, '--add-dir', artifactDir];";
assert.ok(launcher.includes(launchNeedle), 'Kimi must receive a materialized artifact directory');
assert.ok(launcher.includes("function ensureOutputDirectory() {\n  const dir = outputDirectory();"), 'artifact directory helper missing');
console.log('workspace add-dir smoke: PASS');
