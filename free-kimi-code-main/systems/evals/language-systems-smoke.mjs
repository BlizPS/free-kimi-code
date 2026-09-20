import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectLanguages, buildLanguageFrame, getLanguageReport } from '../languages/index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-lang-'));
try {
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}\n');
  fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'main.ts'), 'export const ok: boolean = true;\n');
  const ts = detectLanguages(root);
  assert.equal(ts[0].id, 'typescript');
  assert.match(buildLanguageFrame({ cwd: root }), /\[LANG:typescript\]/);

  fs.rmSync(path.join(root, 'tsconfig.json'));
  fs.rmSync(path.join(root, 'main.ts'));
  fs.writeFileSync(path.join(root, 'go.mod'), 'module example.com/lazydev\n\ngo 1.23\n');
  fs.writeFileSync(path.join(root, 'main.go'), 'package main\n\nfunc main() {}\n');
  const go = detectLanguages(root);
  assert.equal(go[0].id, 'go');
  assert.match(buildLanguageFrame({ cwd: root }), /\[LANG:go\]/);

  const report = getLanguageReport(root);
  assert.equal(report.primary.id, 'go');
  assert.ok(report.contracts[0].commands.tests);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('language systems smoke: PASS');
