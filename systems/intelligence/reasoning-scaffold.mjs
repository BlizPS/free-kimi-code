const BASE = Object.freeze([
  'ground every important claim in repository evidence, tool output, or an authoritative source',
  'decompose non-trivial work into a short ordered plan before editing',
  'make one coherent change at a time and keep the diff scoped to acceptance',
  'after each meaningful action, observe the result before choosing the next action',
  'when blocked, inspect the source of truth, reduce uncertainty, and repair the smallest causal failure',
  'before finishing, run a task-specific verification pass and fix observed failures rather than guessing',
]);

const TASK_RULES = Object.freeze({
  ui: [
    'compile a design brief before UI code: product, visual anchor, hierarchy, density, type, color roles, components, states, responsive behavior, accessibility, motion',
    'prefer existing repository tokens/components; do not invent a fresh visual language when the repo already has one',
    'treat anti-slop checks as constraints: no generic card grid, gradient/glass decoration, pill-everything, fake controls/data, or empty hero chrome unless justified by the product',
  ],
  debug: [
    'reproduce or establish concrete evidence first; separate symptom, mechanism, and fix',
    'preserve a failing case or regression proof until the fix is verified',
  ],
  review: [
    'inspect the diff and surrounding ownership before proposing changes; prioritize correctness, regressions, security, and compatibility',
  ],
  test: [
    'map acceptance to deterministic checks; distinguish passed, failed, blocked, and skipped',
  ],
  artifact: [
    'verify exact output path, file existence, and openability before claiming delivery',
  ],
});

export function reasoningScaffoldRules(primary = 'implementation') {
  return [...BASE, ...(TASK_RULES[primary] || [])];
}

export function buildReasoningScaffoldFrame(primary = 'implementation') {
  const rules = reasoningScaffoldRules(primary);
  return `[COGNITIVE-SCAFFOLD] ${rules.map((rule, index) => `${index + 1})${rule}`).join(' ')}`;
}

export function buildTaskMicroPlan(primary = 'implementation') {
  const common = ['understand request + constraints', 'inspect relevant source', 'plan if non-trivial', 'implement minimal complete change', 'verify behavior', 'report proof + caveats'];
  if (primary === 'ui') return [...common.slice(0, 2), 'compile design system + interaction contract', ...common.slice(3)];
  if (primary === 'debug') return ['reproduce', 'trace ownership + evidence', 'plan causal fix', 'patch', 'run regression proof', 'report proof + caveats'];
  return common;
}
