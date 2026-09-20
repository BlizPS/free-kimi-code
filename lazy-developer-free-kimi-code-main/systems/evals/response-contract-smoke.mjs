import assert from 'node:assert/strict';
import { buildResponseContractFrame, getResponseBudget } from '../communication/response-contract.mjs';

const simple = buildResponseContractFrame({ simple: true, depth: 'focused', primary: 'implementation' });
assert.match(simple, /\[RESP\] mode=direct/);
assert.match(simple, /skill-narration/);
assert.match(simple, /tool-diary/);
assert.match(simple, /preserve=technical-literals/);
assert.equal(getResponseBudget({ simple: true }), 120);
assert.equal(getResponseBudget({ depth: 'deep' }), 420);
assert.equal(getResponseBudget({ primary: 'security', depth: 'focused' }), 320);
console.log('PASS: response contract enforces direct output and adaptive budgets without post-processing');
