#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'hooks', 'lazydev-prompt-context.mjs'), 'utf8');
const required = [
  "const OPENROUTER_FREE_MODEL = 'openrouter/free';",
  'function syntheticToolDefinitions(body = {})',
  'function syntheticToolPrompt(tools)',
  'function prepareSyntheticMessages(messages)',
  'function extractSyntheticToolCalls(content, toolDefs)',
  'function syntheticToolResponse(model, completion, calls, stream)',
  'function toolErrorIsUnsupported(status, detail)',
  'require_parameters: false, allow_fallbacks: true',
  'syntheticToolsActive',
  'learnedNoTools',
  "pc.modelInfo = { ...(pc.modelInfo || {}), toolUse: false, toolUseSource: 'probe' };",
  'X-LazyDev-Synthetic-Tools',
];
const missing = required.filter((needle) => !source.includes(needle));
if (missing.length) {
  console.error('FAIL: missing synthetic tool bridge hardening:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}
if (source.includes('body.models = fallbacks') || source.includes('toolFallbackIndex')) {
  console.error('FAIL: tool capability handling must not switch the user-selected model.');
  process.exit(1);
}
if (/z-ai\/[^'\"`]+.*toolUse\s*:\s*false/i.test(source)) {
  console.error('FAIL: provider/model-specific no-tools hardcodes are not allowed.');
  process.exit(1);
}
if (source.includes('OPENROUTER_MODEL_FALLBACK_LIMIT') || source.includes('buildOpenRouterFreeFallbacks') || source.includes('body.models = fallbacks')) {
  console.error('FAIL: no model-switching fallback remains in the runtime.');
  process.exit(1);
}
if (!source.includes('body.provider = { ...providerOptions, require_parameters: false, allow_fallbacks: true };')) {
  console.error('FAIL: OpenRouter routing must allow feature-aware provider routing.');
  process.exit(1);
}
if (!hook.includes("hook_event_name || 'TurnStarted'")) {
  console.error('FAIL: LazyDev hook event handling is missing.');
  process.exit(1);
}
if (!hook.includes('never write prompt directives to stdout')) {
  console.error('FAIL: UserPromptSubmit hook must keep internal directives out of stdout.');
  process.exit(1);
}
console.log('PASS: capability detection, same-model synthetic tools, OpenRouter routing, and silent prompt hook');
