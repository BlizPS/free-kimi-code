import assert from 'node:assert/strict';
import { extractSessionModelAliases } from '../runtime/session-model-compat.mjs';

const aliases = extractSessionModelAliases([
  '{"model":"lazydev/antigravity-preview-09-2026"}',
  '{"model":"lazydev/gemini-3.5-flash"}',
  '{"model":"lazydev/gemini-3.5-flash"}',
  '{"model":"lazydev/openai/gpt-oss-20b"}',
], 'lazydev/gemini-3.5-flash-lite');
assert.deepEqual(aliases, [
  'lazydev/antigravity-preview-09-2026',
  'lazydev/gemini-3.5-flash',
  'lazydev/openai/gpt-oss-20b',
]);
console.log('PASS: old session model aliases are discovered and can be remapped to the current model');
