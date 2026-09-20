import assert from 'node:assert/strict';
import { canWrapSimpleCommand, wrapSimpleCommand, isRtkMetaCommand } from '../runtime/rtk-integration.mjs';

assert.equal(wrapSimpleCommand('git status'), 'rtk git status');
assert.equal(wrapSimpleCommand('rtk git status'), 'rtk git status');
assert.equal(wrapSimpleCommand('git status && git diff'), 'git status && git diff');
assert.equal(wrapSimpleCommand('git log --oneline -10'), 'rtk git log --oneline -10');
assert.equal(canWrapSimpleCommand('curl https://example.com'), true);
assert.equal(canWrapSimpleCommand('sudo rm -rf x'), false);
assert.equal(isRtkMetaCommand('rtk gain'), true);
assert.equal(wrapSimpleCommand('git diff --no-ext-diff'), 'rtk git diff --no-ext-diff');
assert.equal(wrapSimpleCommand('cat file && echo done'), 'cat file && echo done');
assert.equal(wrapSimpleCommand('RTK_NO_REWRITE=1 git status'), 'RTK_NO_REWRITE=1 git status');
console.log('PASS: native RTK command wrapper smoke');
