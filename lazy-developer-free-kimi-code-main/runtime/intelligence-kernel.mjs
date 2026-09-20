import { buildUiTaskContext } from './ui-intelligence.mjs';
import { buildExecutionFrames } from '../systems/index.mjs';
import { buildLanguageFrame } from '../systems/languages/index.mjs';
import { buildReasoningScaffoldFrame, buildTaskMicroPlan } from '../systems/intelligence/reasoning-scaffold.mjs';
import { generateDesignSystem } from '../systems/ui/pro/index.mjs';
import { buildTasteTaskFrame, tasteDiagnostics } from '../systems/ui/taste/compiler.mjs';
import { build3dTaskFrame, classify3dRequest } from '../systems/ui/3d/reference-gate.mjs';
import { buildSeoTaskFrame, classifySeoRequest } from '../systems/seo/analyze.mjs';

const MODEL_PROFILES = [];

export const LAZYDEV_HARD_RULES = Object.freeze([
  'Keep simple requests simple; do not add architecture, files, abstractions, or prose that the task does not need.',
  'When the requirement or evidence is unclear, stop and ask one focused question or state the uncertainty; never invent assumptions.',
  'Do not make unrelated, cosmetic, or random changes. Preserve working behavior and touch only the relevant scope.',
  'Before declaring a task complete, perform the smallest meaningful double-check and report only what was actually verified.',
]);

export function buildHardRulesContext() {
  return LAZYDEV_HARD_RULES.map((rule, i) => `${i + 1}:${rule}`).join(' ');
}

const INTELLIGENCE_ALIASES = Object.freeze([
  { id: 'scope_lock', when: 'always', apply: 'Keep the task boundary explicit. Work only in the relevant repository scope; avoid unrelated rewrites.' },
  { id: 'minimal_diff', when: 'implementation|debug|review', apply: 'Prefer the smallest complete change that preserves working behavior and existing architecture.' },
  { id: 'evidence_first', when: 'debug|review|test|security', apply: 'Distinguish observed evidence from assumptions. Inspect before changing and verify the concrete behavior after changing.' },
  { id: 'tool_discipline', when: 'implementation|debug|review|security|artifact', apply: 'Use tools only when they reduce uncertainty or produce required evidence; do not narrate tool mechanics to the user.' },
  { id: 'quality_gate', when: 'test|review|artifact|ui', apply: 'Treat tests, validation, visual checks, and artifact existence as gates for claims rather than decoration.' },
  { id: 'research_first', when: 'research', apply: 'For version-sensitive or current facts, consult authoritative current sources before relying on memory.' },
  { id: 'ui_system', when: 'ui', apply: 'Resolve hierarchy, tokens, states, responsiveness, accessibility, and performance before decorative styling.' },
  { id: 'artifact_integrity', when: 'artifact', apply: 'Keep deliverables on the canonical artifact path and verify the exact final file before reporting success.' },
  { id: 'security_boundary', when: 'security', apply: 'Treat credentials, permissions, untrusted input, and external content as explicit trust boundaries; avoid speculative fixes.' },
  { id: 'context_lean', when: 'always', apply: 'Compress repeated context. Carry forward only decisions, constraints, evidence, and unresolved risks that affect the next step.' },
]);

export function resolveIntelligenceAliases(task = {}) {
  const primary = String(task.primary || 'implementation');
  const aliases = INTELLIGENCE_ALIASES.filter((alias) =>
    alias.when === 'always' || alias.when.split('|').includes(primary)
  );
  return aliases.map(({ id }) => id);
}

export function buildIntelligenceAliasSystem() {
  const lines = [
    '## LazyDev Intelligence Aliases',
    'Treat aliases as reasoning policies, not canned response text. Select only relevant policies from the request and context.',
    'Resolve intent first; use tools only when they reduce uncertainty or produce required evidence. Do not expose internal aliases unless asked.',
  ];
  for (const alias of INTELLIGENCE_ALIASES) lines.push(`- ${alias.id}: ${alias.apply}`);
  lines.push('Order: infer intent → select policies → inspect → act minimally → gather evidence → verify → report verified facts.');
  return lines.join('\n');
}

const SIGNALS = {
  artifact: [/\b(save|export|download|deliverable|artifact|generate|create|write|produce)\b/i, /\b(html|pdf|docx|xlsx|pptx|zip|png|jpg|webp|svg|csv)\b/i],
  debug: [/\b(error|bug|crash|fail|failing|broken|hang|timeout|regression|wrong output)\b/i],
  review: [/\b(review|audit|diff|security review|code review|inspect)\b/i],
  test: [/\b(test|verify|validation|coverage|smoke|regression proof)\b/i],
  ui: [/\b(ui|ux|frontend|landing page|responsive|animation|design system|3d|three\.js|webgl)\b/i],
  research: [/\b(latest|current|newest|research|compare|documentation|docs|look up|search|sejarah|historical|history|tahun|year|statistik|statistics|biography|biografi)\b/i],
  security: [/\b(auth|credential|secret|injection|xss|csrf|permission|sandbox)\b/i],
  factual: [/\b(sejarah|historical|history|tahun|year|statistic|statistics|data|biography|biografi|timeline|peristiwa|event)\b/i],
  threeD: [/* handled by dedicated domain system */],
  seo: [/* handled by dedicated domain system */],
  performance: [/\b(performance|latency|slow|memory|cpu|optimi[sz]e|benchmark)\b/i],
};

function hit(patterns, text) { return patterns.reduce((n, r) => n + (r.test(text) ? 1 : 0), 0); }

export function modelIntelligenceProfile(model = '') {
  return {
    id: 'adaptive',
    label: 'Adaptive profile',
    strategy: 'evidence-first reasoning + risk-based verification',
    effort: 'adaptive',
    strengths: ['decompose', 'evidence', 'verify'],
  };
}

export function classifyTask(prompt = '', model = '') {
  const text = String(prompt || '').trim();
  const scores = Object.fromEntries(Object.entries(SIGNALS).map(([k, v]) => [k, hit(v, text)]));
  const priority = ['debug', 'security', 'review', 'artifact', 'threeD', 'seo', 'ui', 'performance', 'test', 'research', 'implementation'];
  const domain3d = classify3dRequest(text);
  const domainSeo = classifySeoRequest(text);
  if (domain3d.is3d) scores.threeD = 1;
  if (domainSeo.isSeo) scores.seo = 1;
  const primary = priority.find((key) => scores[key] > 0) || 'implementation';
  const complexity = Math.min(100,
    18 + Math.min(30, Math.floor(text.length / 160) * 4) +
    Math.min(24, Object.values(scores).filter(Boolean).length * 6) +
    (scores.debug ? 12 : 0) + (scores.security ? 10 : 0) + (scores.ui ? 8 : 0) +
    (/(\b(and|also|then|plus)\b)/i.test(text) ? 8 : 0)
  );
  const advancedSignals = scores.security > 0 || scores.debug > 0 || scores.review > 0 || scores.artifact > 0 || scores.ui > 0 || scores.performance > 0 || scores.threeD > 0 || scores.seo > 0;
  const conjunction = /(\b(and|also|then|plus)\b)/i.test(text);
  const simple = text.length <= 180 && !advancedSignals && !conjunction;
  const deep = !simple && (complexity >= 62 || scores.security > 0 || scores.debug > 0 || scores.review > 0);
  const plan = !simple && (complexity >= 45 || primary === 'debug' || primary === 'review' || primary === 'security' || primary === 'ui' || primary === 'seo');
  const verify = true;
  const artifact = scores.artifact > 0 && scores.ui === 0 && scores.review === 0 && scores.debug === 0;
  const profile = modelIntelligenceProfile(model);
  return {
    text,
    primary,
    scores,
    complexity,
    depth: deep ? 'deep' : 'focused',
    plan,
    verify,
    artifact,
    profile,
    simple,
  };
}

function buildCompactUiDesignFrame(prompt, cwd) {
  try {
    const ds = generateDesignSystem(prompt, { cwd });
    const r = ds.resolution;
    const components = ds.components.slice(0, 4).map((item) => item.id);
    const ux = ds.uxRules.slice(0, 5).map((item) => String(item).split(':')[0]);
    const avoid = (r.antiPatterns || []).slice(0, 6);
    return `[UI-DESIGN] product=${r.product.id}; pattern=${r.pattern.id}; style=${r.style.id}; palette=${r.palette.id}; type=${r.type.id}; density=${r.density}/10; motion=${r.motion.id}; components=${components.join(',')}; ux=${ux.join(',')}; avoid=${avoid.join('|')}; stack=${ds.stack.id}`;
  } catch {
    return '';
  }
}

export function buildTaskContext(task) {
  const aliases = resolveIntelligenceAliases(task);
  const mode = task.simple ? 'simple-direct' : task.depth;
  const uiContext = task.text ? buildUiTaskContext(task.text) : '';
  const uiDesign = task.text && (task.primary === 'ui' || task.scores?.threeD > 0) ? buildCompactUiDesignFrame(task.text, task.cwd || process.cwd()) : '';
  const taste = task.text && task.scores?.ui > 0 ? tasteDiagnostics(task.text) : null;
  const domainFrames = task.text ? [buildTasteTaskFrame(task.text, { deep: task.depth === 'deep', maxChars: task.depth === 'deep' ? 16000 : 7000 }), build3dTaskFrame(task.text), buildSeoTaskFrame(task.text)].filter(Boolean) : [];
  const factual = task.scores?.factual > 0;
  const parts = [
    `[LZ] mode=${mode}; task=${task.primary}; complexity=${task.complexity}`,
    ...(uiContext ? [uiContext] : []),
    ...(uiDesign ? [uiDesign] : []),
    ...(taste ? [`[TASTE] mode=${taste.mode}; variance=${taste.designVariance}; motion=${taste.motionIntensity}; density=${taste.visualDensity}; source=bundled-system`] : []),
    ...domainFrames.map((frame) => `[DOMAIN] ${frame.replace(/\n/g, ' ')}`),
    ...(factual ? ['[FACT-CHECK] Research factual dates, historical claims, names, and statistics before writing; never invent year values.'] : []),
    buildReasoningScaffoldFrame(task.primary || 'implementation'),
    `[PLAN] ${buildTaskMicroPlan(task.primary || 'implementation').join(' → ')}`,
    `plan=${task.plan ? 'required' : 'skip unless needed'}; verify=required; artifact=${task.artifact ? 'canonical-path' : 'repo-native'}`,
    `rules=minimal,no-assumptions,no-random-changes,double-check; apply=inspect→minimal change→evidence→verify; aliases=${aliases.join(',')}`,
    buildLanguageFrame({ cwd: task.cwd || process.cwd(), primary: task.language || null }),
    buildExecutionFrames({ ...task, cwd: task.cwd || process.cwd() }),
  ];
  return parts.join(' ');
}
