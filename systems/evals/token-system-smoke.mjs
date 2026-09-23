import assert from 'node:assert/strict';
import { createTokenSystem } from '../token/bridge.mjs';
import { computeTokenBudget, shouldCompact, allocateTokenBudget } from '../token/budget.mjs';
import { compactText, compactMessages } from '../token/compaction.mjs';
import { compactToolResult } from '../token/observation.mjs';
import { buildPromptCacheKey } from '../token/cachekey.mjs';
import { buildCompactHandoff } from '../token/handoff.mjs';
import { dedupeCalls } from '../token/dedupe.mjs';
import { buildKimiTokenConfig } from '../token/adapters/kimi.mjs';
import { buildPluginTokenDirective } from '../token/adapters/plugin.mjs';
import { buildSkillTokenDirective } from '../token/adapters/skill.mjs';
import { buildClaudeTokenHookContext } from '../token/adapters/claude.mjs';
import { buildCursorTokenDirective } from '../token/adapters/cursor.mjs';
import { buildCodexTokenDirective } from '../token/adapters/codex.mjs';
import { buildGeminiTokenDirective } from '../token/adapters/gemini.mjs';
import { buildAgentsTokenDirective } from '../token/adapters/agents.mjs';
import { buildOpenCodeTokenDirective } from '../token/adapters/opencode.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const budget = computeTokenBudget({ maxContext: 65536, maxOutput: 8192 });
assert.ok(budget.reserve > 0);
assert.ok(budget.output <= 32768);
assert.ok(budget.input + budget.reserve <= budget.max);
assert.equal(shouldCompact({ max: 10000, used: 9000, reserve: 500 }), true);
assert.deepEqual(Object.keys(allocateTokenBudget(1000, { core: 4, history: 1 })).sort(), ['core', 'history']);

const text = 'Sure.\nRepeated line\nRepeated line\nError: request failed\nPath: src/app.ts\nhttps://example.com/docs';
const compacted = compactText(text + '\n' + 'x'.repeat(6000), 220);
assert.match(compacted, /Error: request failed/);
assert.match(compacted, /src\/app\.ts/);
assert.match(compacted, /https:\/\/example\.com\/docs/);

const messages = compactMessages(Array.from({ length: 12 }, (_, i) => ({ role: i === 0 ? 'system' : 'user', content: `message ${i} ${'x'.repeat(900)}` })), { tokenBudget: 500, keepRecent: 2 });
assert.ok(messages.estimatedTokens <= 500);

const tool = compactToolResult(('same\n'.repeat(1000)) + 'Error: failed at src/app.ts', { maxChars: 1000 });
assert.ok(tool.length <= 1000);
assert.match(tool, /Error: failed/);

assert.equal(buildPromptCacheKey({ model: 'm', system: 's' }), buildPromptCacheKey({ system: 's', model: 'm' }));
assert.match(buildCompactHandoff({ task: 'fix bug', findings: ['found race'], proof: 'test passed' }), /task=fix bug/);
assert.equal(dedupeCalls([{ name: 'Read', args: { path: 'a' } }, { name: 'Read', args: { path: 'a' } }]).length, 1);
assert.match(buildKimiTokenConfig(budget).join('\n'), /token_counting/);
assert.match(buildPluginTokenDirective(), /progressive disclosure/i);
assert.match(buildSkillTokenDirective(), /progressive disclosure/i);
assert.match(buildClaudeTokenHookContext(), /Result first/);
for (const directive of [buildCursorTokenDirective(), buildCodexTokenDirective(), buildGeminiTokenDirective(), buildAgentsTokenDirective(), buildOpenCodeTokenDirective()]) assert.match(directive, /context|instructions|progressive/i);
const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../token/manifest.json'), 'utf8'));
assert.equal(manifest.version, '1.0.0');
for (const host of ['cli', 'plugins', 'kimi', 'claude', 'cursor', 'codex', 'agents', 'gemini', 'opencode']) assert.ok(manifest.hosts.includes(host));

const runtime = createTokenSystem({ maxContext: 32768 });
runtime.ledger.record('test', { input: 10, output: 5, saved: 20 });
assert.equal(runtime.ledger.snapshot().totals.saved, 20);
console.log('PASS: token budgeting, compaction, bounded observations, dedupe, cache keys, handoffs, metrics, and host adapters');
