import assert from 'node:assert/strict';
import { createTaskState, transition, noteEvidence, noteChange } from '../agent/task-state.mjs';
import { chooseSubagents, buildAgentFrame } from '../agent/subagent-router.mjs';
import { estimateStepBudget } from '../agent/step-budget.mjs';
import { computeContextBudget, allocateContextBudget } from '../context/context-budget.mjs';
import { pruneContext, compactEvidence } from '../context/prune.mjs';
import { fingerprint, sameFingerprint } from '../context/fingerprint.mjs';
import { needsResearch, buildResearchQuery } from '../research/research-gate.mjs';
import { EvidenceCache } from '../research/evidence-cache.mjs';
import { classifyFailure, recoveryAction } from '../recovery/failure-classifier.mjs';
import { nextRetry } from '../recovery/retry-policy.mjs';
import { deriveAcceptance, acceptanceStatus } from '../verification/acceptance.mjs';
import { selectVerificationPlan } from '../verification/check-plan.mjs';
import { toolRisk, shouldUseTool } from '../tools/tool-policy.mjs';
import { ToolCallMemory } from '../tools/call-memory.mjs';
import { TaskLedger } from '../memory/ledger.mjs';
import { buildUiDesignContract } from '../ui/design-contract.mjs';
import { responsiveContract } from '../ui/responsive-contract.mjs';
import { missingStates } from '../ui/state-matrix.mjs';
import { safeJson } from '../serialization/safe-json.mjs';
import { classifyBoundary, shouldRedact } from '../security/boundary.mjs';

let state = createTaskState({ task: 'build a responsive UI' });
let moved = transition(state, 'inspect', 'initial repository inspection');
assert.equal(moved.ok, true);
state = moved.state;
state = noteEvidence(state, 'existing UI route', 'fact');
state = noteChange(state, 'src/app.ts', 'modified');
assert.equal(state.evidence.length, 1);
assert.equal(state.changes.length, 1);

const task = { primary: 'ui', depth: 'deep', complexity: 70, plan: true, text: 'Build a responsive Kimi Code inspired workspace UI' };
assert.deepEqual(chooseSubagents(task), ['explore', 'plan', 'coder']);
assert.match(buildAgentFrame(task), /roles=explore,plan,coder/);
assert.ok(estimateStepBudget(task) >= 8);

const budget = computeContextBudget({ contextLimit: 65536, outputLimit: 8192 });
const allocation = allocateContextBudget(budget, { core: 4, evidence: 3, tools: 2, history: 1 });
assert.ok(allocation.core > allocation.history);
const pruned = pruneContext([
  { text: 'stale note', kind: 'stale' },
  { text: 'responsive overflow at 360px', kind: 'evidence', pinned: true },
  { text: 'unrelated history note', kind: 'stale' },
], { query: 'responsive overflow', tokenBudget: 80 });
assert.match(pruned.blocks[0].text, /responsive overflow/);
assert.ok(compactEvidence('x'.repeat(100), 40).length <= 40);
assert.equal(sameFingerprint({ a: 1 }, { a: 1 }), true);
assert.equal(fingerprint('x').length, 16);

assert.equal(needsResearch(task), true);
assert.match(buildResearchQuery(task), /official documentation/i);
const cache = new EvidenceCache({ ttlMs: 1000 });
cache.set('kimi', { ok: true }, 1000);
assert.deepEqual(cache.get('kimi', 1500), { ok: true });
assert.equal(cache.get('kimi', 2501), null);

const failure = classifyFailure(new Error('context window exceeded'));
assert.equal(failure.kind, 'context');
assert.equal(recoveryAction(failure), 'compact-and-retry');
assert.equal(nextRetry({ kind: 'network' }, 0, { committed: false }).retry, true);
assert.equal(nextRetry({ kind: 'network' }, 2, { committed: false }).retry, false);

const acceptance = deriveAcceptance(task);
assert.ok(acceptance.minimum.includes('render'));
assert.equal(acceptanceStatus(acceptance, [{ name: 'render', ok: true }]).complete, false);
assert.ok(selectVerificationPlan(task).includes('narrow-width'));

assert.equal(toolRisk('Bash'), 'high');
assert.equal(shouldUseTool('Bash', task, {}), false);
const memory = new ToolCallMemory();
memory.remember('Read', { path: 'src/app.ts' }, { ok: true });
assert.equal(memory.seen('Read', { path: 'src/app.ts' }), true);

const ledger = new TaskLedger();
ledger.addConstraint('preserve existing UI');
ledger.addEvidence('ui', 'rendered successfully', 'verified');
ledger.addChange('src/app.ts', 'wire UI');
assert.match(ledger.compact(), /constraints=/);

const design = buildUiDesignContract({
  domain: 'application',
  source: '<div class="card gradient">fake@example.com</div>',
  preserveIdentity: true,
});
assert.ok(design.analysis.slopScore > 0);
assert.ok(design.corrections.length > 0);
assert.ok(responsiveContract().narrow.length >= 2);
assert.ok(missingStates(['idle', 'loading']).includes('error'));

assert.equal(classifyBoundary('remote URL with api_key').trust, 'untrusted');
assert.equal(shouldRedact('api_key=secret'), true);
assert.ok(safeJson({ bigint: 1n }).includes('1n'));

console.log('PASS: agent state, subagent routing, context compaction, research gates, recovery, verification, tool policy, ledger, UI contracts, boundaries, and serialization');
