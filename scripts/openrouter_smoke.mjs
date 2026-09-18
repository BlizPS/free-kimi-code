#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'hooks', 'lazydev-prompt-context.mjs'), 'utf8');
const required = [
  "const OPENROUTER_FREE_MODEL = 'openrouter/free';",
  'function syntheticOpenRouterFreeModel()',
  'const fallbacks = Array.from(new Set(freeFallbacks)).filter((id) => id && id !== pc.model).slice(0, OPENROUTER_MODEL_FALLBACK_LIMIT)',
  'require_parameters: true, allow_fallbacks: true',
  "res.statusCode === 404 || res.statusCode === 429",
  'OPENROUTER_FREE_MODEL} included',
  'buildOpenRouterFreeFallbacks(pc.model, openRouterModels)',
];
const missing = required.filter((needle) => !source.includes(needle));
if (missing.length) {
  console.error('FAIL: missing OpenRouter hardening:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}
if (!source.includes('const OPENROUTER_MODEL_FALLBACK_LIMIT = 3;')) {
  console.error('FAIL: OpenRouter model fallback limit must be exactly 3.');
  process.exit(1);
}
if (!source.includes('if (fallbacks.length) body.models = fallbacks;')) {
  console.error('FAIL: OpenRouter must omit empty fallback arrays.');
  process.exit(1);
}
if (/OPENROUTER_FREE_FALLBACK_LIMIT/.test(source)) {
  console.error('FAIL: stale OpenRouter fallback limit constant remains.');
  process.exit(1);
}
if (/console\.log|process\.stdout\.write|process\.stdout\.end/.test(hook)) {
  console.error('FAIL: LazyDev turn hook must remain silent.');
  process.exit(1);
}
console.log('PASS: OpenRouter free router, fallback routing, 404/429 handling, and silent turn hook wiring');
