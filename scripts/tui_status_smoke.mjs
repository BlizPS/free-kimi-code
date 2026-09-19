import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('scripts/lazydev.mjs'), 'utf8');
if (!source.includes('lazydev-statusline.mjs')) {
  throw new Error('Live status-line hook is not wired into the generated TUI config.');
}
if (source.includes('items = ["mode", "model", "tasks", "cwd", "git", "tips"]')) {
  throw new Error('Legacy fixed status-line items are still configured.');
}
const hook = path.resolve('hooks/lazydev-statusline.mjs');
if (!fs.existsSync(hook)) throw new Error('Live status-line hook file is missing.');
console.log('tui_status_smoke: PASS');
