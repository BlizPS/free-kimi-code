import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const errors = [];

if (!src.includes("function isAntigravityModel(modelId)")) errors.push('Antigravity classifier missing for disabled-model migration');
if (!src.includes("return models.filter((m) => !isAntigravityModel(m.id));")) errors.push('Disabled Antigravity models must be hidden from Gemini setup catalog');
if (!src.includes("if (isAntigravityModel(pc.model))")) errors.push('Legacy saved Antigravity config guard missing');
if (!src.includes("const fallback = providers.find((candidate) => {")) errors.push('Disabled-model fallback migration missing');
if (src.includes("createAntigravityProxy({")) errors.push('Antigravity proxy must not be started by LazyDev');
if (!src.includes("ANTIGRAVITY_AGENT = 'antigravity-preview-09-2026'")) errors.push('Disabled model identifier missing');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS: disabled-model migration and Gemini catalog exclusion are enforced');
