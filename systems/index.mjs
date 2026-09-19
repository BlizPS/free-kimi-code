import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenEconomyFrame } from './token/index.mjs';
import { buildAgentFrame } from './agent/subagent-router.mjs';
import { buildRecoveryFrame } from './recovery/retry-policy.mjs';
import { buildVerificationFrame } from './verification/check-plan.mjs';
import { buildResponseContractFrame } from './communication/response-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  try { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').trim(); }
  catch { return ''; }
}

export const NATIVE_SYSTEM_PROMPT = Object.freeze([
  '## LazyDev Native Systems',
  'Built-in execution rules stay active even without Skills.',
  'Core: reuse responsible code; choose the simplest complete repo-native path; avoid speculative architecture; preserve safety, accessibility, compatibility, and required tests.',
  'Investigation: separate symptom from hypothesis; trace ownership/evidence; edit after a credible mechanism is established.',
  'Build: derive acceptance + non-goals; deliver a coherent end-to-end path; add structure only when acceptance/lifecycle requires it.',
  'Verify: run the smallest sufficient proof; distinguish pass/fail/unavailable/blocked; stop when acceptance is proven.',
  'Token economy: progressive disclosure; bounded observations; targeted reads/search; deduplicate repeated work; compact before overflow; preserve exact technical literals and negation/order.',
  'Agent mechanics: isolate exploration, plan multi-file work, implement one coherent change, classify failures before recovery, verify acceptance, and stop on proof.',
  'Response: lead with the result or next action; never narrate Skill activation, tool mechanics, hidden reasoning, or a progress diary; compress repetition but preserve technical literals, negation, order, caveats, and proof.',
  'UI: inspect → research targeted references when warranted → define hierarchy/system → implement real states → stress responsive behavior → verify visually → polish observed mismatches only.',
].join('\n'));

export function buildNativeSystemsPrompt() {
  return NATIVE_SYSTEM_PROMPT;
}

export function buildExecutionFrames(task = {}) {
  return [
    buildAgentFrame(task),
    buildVerificationFrame(task),
    buildRecoveryFrame(),
    buildResponseContractFrame(task),
  ].join(' ');
}

export function buildSystemStats() {
  return {
    sourceRoot: ROOT,
    nativePromptTokens: Math.ceil(NATIVE_SYSTEM_PROMPT.length / 4),
    tokenFrame: buildTokenEconomyFrame({ budget: 0, used: 0 }),
    sources: [
      'core/native-core.md',
      'token/token-economy.md',
      'token/SYSTEM.md',
      'token/manifest.json',
      'token/index.mjs',
      'token/budget.mjs',
      'token/compaction.mjs',
      'token/observation.mjs',
      'token/dedupe.mjs',
      'token/cachekey.mjs',
      'token/handoff.mjs',
      'token/metrics.mjs',
      'token/bridge.mjs',
      'token/loader.mjs',
      'token/adapters/index.mjs',
      'token/adapters/kimi.mjs',
      'token/adapters/plugin.mjs',
      'token/adapters/skill.mjs',
      'token/adapters/claude.mjs',
      'token/adapters/generic.mjs',
      'token/adapters/cursor.mjs',
      'token/adapters/codex.mjs',
      'token/adapters/gemini.mjs',
      'token/adapters/agents.mjs',
      'token/adapters/opencode.mjs',
      'context/context-policy.md',
      'workflows/investigate-first.md',
      'workflows/lean-build.md',
      'workflows/verify-and-stop.md',
      'ui/ui-generation.md',
      'ui/ui-quality.md',
      'ui/design-contract.mjs',
      'ui/heuristics.mjs',
      'ui/responsive-contract.mjs',
      'ui/state-matrix.mjs',
      'agent/agent-loop.md',
      'agent/task-state.mjs',
      'agent/subagent-router.mjs',
      'agent/step-budget.mjs',
      'context/compaction.md',
      'context/context-budget.mjs',
      'context/prune.mjs',
      'context/fingerprint.mjs',
      'research/research-policy.md',
      'research/research-gate.mjs',
      'research/evidence-cache.mjs',
      'recovery/recovery.md',
      'recovery/failure-classifier.mjs',
      'recovery/retry-policy.mjs',
      'verification/verification.md',
      'verification/acceptance.mjs',
      'verification/check-plan.mjs',
      'tools/tool-use.md',
      'tools/tool-policy.mjs',
      'tools/call-memory.mjs',
      'memory/ledger.mjs',
      'security/boundary-policy.md',
      'security/boundary.mjs',
      'serialization/serialization.md',
      'serialization/safe-json.mjs',
      'communication/response-contract.md',
      'communication/response-contract.mjs',
    ],
  };
}
