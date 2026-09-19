#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyTask, buildTaskContext, modelIntelligenceProfile, resolveIntelligenceAliases, buildIntelligenceAliasSystem, buildHardRulesContext } from '../runtime/intelligence-kernel.mjs';
import { buildReasoningScaffoldFrame } from '../systems/intelligence/reasoning-scaffold.mjs';

const generic = modelIntelligenceProfile('provider/model');
assert.equal(generic.id, 'adaptive');
assert.equal(generic.effort, 'adaptive');
assert.match(buildIntelligenceAliasSystem(), /select only relevant policies/i);
assert.match(buildHardRulesContext(), /Keep simple requests simple/);
assert.match(buildHardRulesContext(), /never invent assumptions/);
assert.match(buildHardRulesContext(), /random/);
assert.match(buildHardRulesContext(), /double-check/);
const ui = classifyTask('Build a polished responsive landing page and verify it', 'provider/model');
assert.equal(ui.primary, 'ui');
assert.ok(resolveIntelligenceAliases(ui).includes('ui_system'));
const debug = classifyTask('Fix the crash after refactor and add regression proof', 'provider/model');
assert.equal(debug.primary, 'debug');
assert.equal(debug.depth, 'deep');
assert.match(buildTaskContext(debug), /inspect→minimal change→evidence→verify/);
assert.match(buildTaskContext(debug), /COGNITIVE-SCAFFOLD/);
assert.match(buildReasoningScaffoldFrame('debug'), /reproduce/);
assert.ok(resolveIntelligenceAliases(debug).includes('evidence_first'));
assert.match(buildIntelligenceAliasSystem(), /LazyDev Intelligence Aliases/);
assert.doesNotMatch(buildIntelligenceAliasSystem(), /(?:respond|reply|answer|write) (?:in|using) [a-z]+/i);
assert.doesNotMatch(fs.readFileSync(new URL('../runtime/SYSTEM.md', import.meta.url), 'utf8'), /(?:respond|reply|answer|write) (?:in|using) [a-z]+/i);
assert.match(fs.readFileSync(new URL('../runtime/PLUGIN-PROMPT.md', import.meta.url), 'utf8'), /first user turn of a new session[\s\S]*respond in English unless the user explicitly requests another language/i);
console.log('PASS: adaptive intelligence routing and generic model profile');
