import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const errors = [];

if (!src.includes("function isAntigravityModel(modelId)")) { errors.push('Antigravity model classifier missing'); }
if (src.includes(".filter((x) => !isAntigravityModel(x.name))")) { errors.push('Antigravity models must remain selectable'); }
if (!src.includes("ANTIGRAVITY_AGENT = 'antigravity-preview-09-2026'")) { errors.push('Antigravity agent id missing'); }
if (!src.includes('createAntigravityProxy')) { errors.push('Antigravity proxy integration missing'); }
if (src.includes('recoverUnsupportedGeminiModel')) { errors.push('Legacy Antigravity fallback still disables the model'); }
if (!src.includes("const antigravity = provider.id === 'gemini' && isAntigravityModel(pc.model);")) { errors.push('Antigravity session routing missing'); }
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
console.log('PASS: Gemini Antigravity stateful proxy routing, tool calling, and Kimi version stability protection');
