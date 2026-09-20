#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildUiSystemPrompt, buildUiTaskContext, classifyUiRequest } from '../runtime/ui-intelligence.mjs';

const kimi = classifyUiRequest('Build a polished Kimi Code-like coding workspace UI with responsive side panels and animations.');
assert.equal(kimi.isUi, true);
assert.equal(kimi.domain, 'application');
assert.equal(kimi.reference, true);
assert.equal(kimi.researchFirst, true);
assert.match(buildUiTaskContext(kimi.isUi ? 'Build a Kimi Code-like coding workspace UI' : ''), /research=first/);

const dashboard = classifyUiRequest('Create an analytics dashboard with filters and a dense table.');
assert.equal(dashboard.isUi, true);
assert.equal(dashboard.domain, 'dashboard');

const preserved = classifyUiRequest("Keep the existing UI and fix the mobile layout overflow.");
assert.equal(preserved.isUi, true);
assert.equal(preserved.preserve, true);

const plain = classifyUiRequest('Fix the parser error in src/parser.ts.');
assert.equal(plain.isUi, false);
assert.equal(buildUiTaskContext(plain.isUi ? 'x' : plain.isUi), '');

const prompt = buildUiSystemPrompt();
for (const signal of [
  'inspect UI/stack/assets/routes/tokens',
  'research one targeted reference first',
  'Extract patterns, never copy',
  'Implement real loading/empty/error/success',
  'Stress mobile/tablet/desktop',
  'Kimi Code',
  'does not depend on a Skill',
]) assert.match(prompt, new RegExp(signal.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'i'));

assert.doesNotMatch(prompt, /purple\/pink gradients/i);
console.log('PASS: built-in UI intelligence, reference research gate, anti-slop heuristics, and responsive verification rules');
