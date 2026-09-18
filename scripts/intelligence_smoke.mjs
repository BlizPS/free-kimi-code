#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyTask, buildTaskContext, modelIntelligenceProfile, resolveIntelligenceAliases, buildIntelligenceAliasSystem } from '../runtime/intelligence-kernel.mjs';

const generic = modelIntelligenceProfile('provider/model');
assert.equal(generic.id, 'adaptive');
assert.equal(generic.effort, 'adaptive');
const ui = classifyTask('Build a polished responsive landing page and verify it', 'provider/model');
assert.equal(ui.primary, 'ui');
assert.ok(resolveIntelligenceAliases(ui).includes('ui_system'));
const debug = classifyTask('Fix the crash after refactor and add regression proof', 'provider/model');
assert.equal(debug.primary, 'debug');
assert.equal(debug.depth, 'deep');
assert.match(buildTaskContext(debug), /inspect→minimal change→evidence→verify/);
assert.ok(resolveIntelligenceAliases(debug).includes('evidence_first'));
assert.match(buildIntelligenceAliasSystem(), /LazyDev Intelligence Alias System/);
assert.doesNotMatch(buildIntelligenceAliasSystem(), /(?:respond|reply|answer|write) (?:in|using) [a-z]+/i);
assert.doesNotMatch(fs.readFileSync(new URL('../runtime/SYSTEM.md', import.meta.url), 'utf8'), /(?:respond|reply|answer|write) (?:in|using) [a-z]+/i);
console.log('PASS: adaptive intelligence routing and generic model profile');
