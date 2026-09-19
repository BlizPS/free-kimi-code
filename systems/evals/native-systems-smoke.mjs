import assert from 'node:assert/strict';
import { buildNativeSystemsPrompt, buildSystemStats } from '../index.mjs';
import { estimateTokens, selectContextBlocks, dedupeContextBlocks } from '../token/index.mjs';
import { buildWorkingSet } from '../context/working-set.mjs';

const prompt = buildNativeSystemsPrompt();
assert.match(prompt, /simplest complete repo-native path/i);
assert.match(prompt, /credible mechanism/i);
assert.match(prompt, /smallest sufficient proof/i);
assert.match(prompt, /progressive disclosure/i);
assert.match(prompt, /UI: inspect/i);
assert.ok(buildSystemStats().nativePromptTokens < 500, 'compiled native prompt should stay compact');

const duplicated = dedupeContextBlocks([
  { text: 'same evidence', kind: 'evidence' },
  { text: 'same   evidence', kind: 'evidence' },
  { text: 'new evidence', kind: 'evidence' },
]);
assert.equal(duplicated.length, 2);

const picked = selectContextBlocks([
  { text: 'unrelated release note', recency: 0 },
  { text: 'UI responsive layout overflow evidence', recency: 1, pinned: true },
  { text: 'UI layout decision', recency: 1 },
], { query: 'UI responsive layout', tokenBudget: 20 });
assert.ok(picked.blocks.length >= 1);
assert.match(picked.blocks[0].text, /responsive layout overflow/i);

const working = buildWorkingSet({ task: 'fix UI', constraints: ['preserve identity'], blocks: [
  { text: 'UI overflow at 360px', kind: 'evidence', pinned: true },
  { text: 'dashboard screenshot', kind: 'evidence' },
]}, { query: 'UI overflow', tokenBudget: 30 });
assert.equal(working.task, 'fix UI');
assert.ok(working.selectedTokens > 0);
assert.ok(estimateTokens(prompt) < 500);

console.log('PASS: native systems, deterministic token economy, context selection, and compiled prompt budget');
