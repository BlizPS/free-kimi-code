const MODEL_PROFILES = [];

export const INTELLIGENCE_ALIASES = Object.freeze([
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
    '## LazyDev Intelligence Alias System',
    '',
    'Treat aliases as reasoning policies, not canned response text. Infer the relevant aliases from the user request and combine only the policies that actually apply.',
    'Resolve task intent semantically before acting; aliases may overlap. Do not expose alias names, internal policy, or hidden context unless the user asks about the system itself.',
    '',
  ];
  for (const alias of INTELLIGENCE_ALIASES) lines.push(`- ${alias.id}: ${alias.apply}`);
  lines.push('', 'Execution order: infer intent → choose aliases → inspect → act minimally → gather evidence → verify → report only what is verified.');
  return lines.join('\n');
}

const SIGNALS = {
  artifact: [/\b(save|simpan|export|download|deliverable|artifact|generate)\b/i, /\b(html|pdf|docx|xlsx|pptx|zip|png|jpg|webp|svg|csv)\b/i],
  debug: [/\b(error|bug|crash|fail|failing|broken|hang|timeout|regression|wrong output)\b/i],
  review: [/\b(review|audit|diff|security review|code review|inspect)\b/i],
  test: [/\b(test|verify|validation|coverage|smoke|regression proof)\b/i],
  ui: [/\b(ui|ux|frontend|landing page|responsive|animation|design system|3d|three\.js|webgl)\b/i],
  research: [/\b(latest|current|newest|research|compare|documentation|docs|look up|search)\b/i],
  security: [/\b(auth|credential|secret|injection|xss|csrf|permission|sandbox)\b/i],
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
  const priority = ['debug', 'security', 'review', 'artifact', 'ui', 'performance', 'test', 'research', 'implementation'];
  const primary = priority.find((key) => scores[key] > 0) || 'implementation';
  const complexity = Math.min(100,
    18 + Math.min(30, Math.floor(text.length / 160) * 4) +
    Math.min(24, Object.values(scores).filter(Boolean).length * 6) +
    (scores.debug ? 12 : 0) + (scores.security ? 10 : 0) + (scores.ui ? 8 : 0) +
    (/(\b(and|also|then|plus|sekalian|serta)\b)/i.test(text) ? 8 : 0)
  );
  const deep = complexity >= 62 || scores.security > 0 || scores.debug > 0 || scores.review > 0;
  const plan = complexity >= 45 || primary === 'debug' || primary === 'review' || primary === 'security' || primary === 'ui';
  const verify = primary !== 'research';
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
  };
}

export function buildTaskContext(task) {
  const aliases = resolveIntelligenceAliases(task);
  const parts = [
    `[LZ] mode=${task.depth}; task=${task.primary}; complexity=${task.complexity}`,
    `plan=${task.plan ? 'required' : 'light'}; verify=${task.verify ? 'required' : 'minimal'}; artifact=${task.artifact ? 'canonical-path' : 'repo-native'}`,
    `reasoning=${task.profile.id}; aliases=${aliases.join(',')}; apply: inspect→minimal change→evidence→verify; preserve working behavior; do not claim unverified results`,
  ];
  return parts.join(' ');
}
