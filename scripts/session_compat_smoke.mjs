import assert from 'node:assert/strict';
import { extractSessionModelAliases } from '../runtime/session-model-compat.mjs';

const aliases = extractSessionModelAliases([
  '{"model":"lazydev/gemini-3.8-flash-medium"}',
  '{"model":"lazydev/gemini-3.5-flash"}',
  '{"model":"lazydev/gemini-3.5-flash"}',
  '{"model":"lazydev/openai/gpt-oss-20b"}',
  '{"model":"ag/claude-opus-4-6-thinking"}',
], 'lazydev/gemini-3.5-flash-lite');
assert.deepEqual(aliases, [
  'lazydev/gemini-3.8-flash-medium',
  'lazydev/gemini-3.5-flash',
  'lazydev/openai/gpt-oss-20b',
  'lazydev/ag/claude-opus-4-6-thinking',
]);
console.log('PASS: old session model aliases are discovered and can be remapped to the current model');
