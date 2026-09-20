import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenEconomyFrame } from './token/index.mjs';
import { buildAgentFrame } from './agent/subagent-router.mjs';
import { buildRecoveryFrame } from './recovery/retry-policy.mjs';
import { buildVerificationFrame } from './verification/check-plan.mjs';
import { buildResponseContractFrame } from './communication/response-contract.mjs';
import { buildLanguageFrame, getLanguageReport } from './languages/index.mjs';
import { buildTasteSystemPrompt, buildTasteTaskFrame, tasteDiagnostics } from './ui/taste/compiler.mjs';
import { build3dSystemPrompt, build3dTaskFrame, classify3dRequest } from './ui/3d/reference-gate.mjs';
import { buildSeoSystemPrompt, buildSeoTaskFrame, classifySeoRequest } from './seo/analyze.mjs';

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
  'Token economy: progressive disclosure; bounded observations; targeted reads/search; deduplicate repeated work; compact before overflow; preserve exact technical literals and negation/order. Old repeated tool-output lines may use [lazy-repeat N @m#:L#] references; treat them as repeats of the earlier referenced lines. Near context pressure, repeated tool-output rows may also use [lazy-template N "prefix"] followed by N suffix rows; reconstruct each row as prefix + suffix, without inventing or deleting facts.',
  'Agent mechanics: isolate exploration, keep a short micro-plan for non-trivial work, implement one coherent change, observe each result, classify failures before recovery, verify acceptance, and stop on proof.',
  'Model-agnostic scaffold: assume uneven reasoning; use decomposition, source-of-truth inspection, bounded tools, causal repair, and deterministic verification.',
  'Response: lead with the result or next action; never narrate Skill activation, tool mechanics, hidden reasoning, or a progress diary; compress repetition but preserve technical literals, negation, order, caveats, and proof.',
  'UI: inspect → compile the local personal Pro design system → research named external references when warranted → define hierarchy/system → implement real states → stress responsive behavior → verify visually → polish observed mismatches only.',
].join('\n'));

export function buildNativeSystemsPrompt() {
  return NATIVE_SYSTEM_PROMPT;
}

export function buildDomainSystemsPrompt() {
  return [buildTasteSystemPrompt(), build3dSystemPrompt(), buildSeoSystemPrompt()].join('\n\n');
}

export function buildDomainTaskFrames(prompt = '') {
  return [buildTasteTaskFrame(prompt, { deep: false, maxChars: 9000 }), build3dTaskFrame(prompt), buildSeoTaskFrame(prompt)].filter(Boolean).join(' ');
}

export function buildExecutionFrames(task = {}) {
  return [
    buildAgentFrame(task),
    buildVerificationFrame(task),
    buildRecoveryFrame(),
    buildResponseContractFrame(task),
    buildLanguageFrame({ cwd: task.cwd || process.cwd(), primary: task.language || null }),
  ].join(' ');
}

export function buildSystemStats() {
  return {
    sourceRoot: ROOT,
    nativePromptTokens: Math.ceil(NATIVE_SYSTEM_PROMPT.length / 4),
    tokenFrame: buildTokenEconomyFrame({ budget: 0, used: 0 }),
    sources: [
      'core/native-core.md',
      'intelligence/SYSTEM.md',
      'intelligence/reasoning-scaffold.mjs',
      'recovery/retry-policy.mjs',
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
      'token/foveance.mjs',
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
      'ui/taste/taste-core.md',
      'ui/taste/compiler.mjs',
      'ui/taste/LICENSE',
      'ui/taste/NOTICE.md',
      'ui/3d/policy.md',
      'ui/3d/reference-gate.mjs',
      'seo/policy.md',
      'seo/analyze.mjs',
      'seo/index.mjs',
      'ui/ui-quality.md',
      'ui/pro/README.md',
      'ui/pro/index.mjs',
      'ui/pro/bm25.mjs',
      'ui/pro/reasoning.mjs',
      'ui/pro/generator.mjs',
      'ui/pro/quality.mjs',
      'ui/pro/stack-detect.mjs',
      'ui/pro/persist.mjs',
      'ui/pro/data/products.json',
      'ui/pro/data/styles.json',
      'ui/pro/data/patterns.json',
      'ui/pro/data/palettes.json',
      'ui/pro/data/typography.json',
      'ui/pro/data/motion.json',
      'ui/pro/data/ux.json',
      'ui/pro/data/components.json',
      'ui/pro/data/stacks.json',
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
    'languages/README.md',
    'languages/index.mjs',
    'languages/detect.mjs',
    'languages/typescript/index.mjs',
    'languages/typescript/profile.ts',
    'languages/golang/index.mjs',
    'languages/golang/profile.go',
    ],
  };
}
