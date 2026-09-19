import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-language-cli-'));
try {
  fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'index.ts'), 'export const ready: boolean = true;\n');
  const cli = spawnSync(process.execPath, ['scripts/lazydev.mjs', 'lang', '--json', '--project', root], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const report = JSON.parse(cli.stdout);
  assert.equal(report.primary.id, 'typescript');

  fs.rmSync(path.join(root, 'tsconfig.json'));
  fs.rmSync(path.join(root, 'index.ts'));
  fs.writeFileSync(path.join(root, 'go.mod'), 'module example.com/lazydev\n\ngo 1.23\n');
  fs.writeFileSync(path.join(root, 'main.go'), 'package main\n\nfunc main() {}\n');
  const go = spawnSync(process.execPath, ['scripts/lazydev.mjs', 'lang', '--json', '--project', root], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(go.status, 0, go.stderr);
  const goReport = JSON.parse(go.stdout);
  assert.equal(goReport.primary.id, 'go');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('language CLI integration smoke: PASS');
