import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const errors = [];

if (!src.includes("const GEMINI_NO_TOOL_MODELS = [/^antigravity-preview(?:-|$)/i];")) {
  errors.push('Antigravity no-tool compatibility matcher missing');
}
if (!src.includes("disabled = ${JSON.stringify(KIMI_BUILTIN_TOOLS)}")) {
  errors.push('Kimi global tool denylist missing for no-tool models');
}
if (!src.includes("const modelCapabilities = toolUse ?")) {
  errors.push('Model capability gating missing');
}
if (!src.includes('KIMI_CODE_NO_AUTO_UPDATE: \'1\'')) {
  errors.push('Kimi auto-update lock missing');
}
if (!src.includes('auto_install = false')) {
  errors.push('Kimi TUI auto-install update lock missing');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: Gemini Antigravity no-tool compatibility, tool gating, and Kimi version stability protection');
