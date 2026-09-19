import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('scripts/lazydev.mjs'), 'utf8');
const expected = '`items = ["mode", "model", "tasks", "cwd", "git", "tips"]`';
if (!source.includes(expected)) {
  throw new Error('TUI status line still exposes the native goal item.');
}
if (source.includes('`items = ["mode", "goal", "model", "tasks", "cwd", "git", "tips"]`')) {
  throw new Error('Legacy goal status-line configuration is still present.');
}
console.log('tui_status_smoke: PASS');
