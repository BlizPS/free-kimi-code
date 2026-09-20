export function estimateStepBudget(task = {}) {
  const complexity = Math.max(0, Math.min(100, Number(task.complexity || 0)));
  const base = task.simple ? 2 : 4;
  const risk = ['debug', 'security', 'review'].includes(task.primary) ? 2 : 0;
  const ui = task.primary === 'ui' ? 2 : 0;
  const depth = task.depth === 'deep' ? 2 : 0;
  return Math.min(12, Math.max(base, base + Math.ceil(complexity / 30) + risk + ui + depth));
}

export function shouldEscalateStep(state = {}, task = {}) {
  const used = Number(state.step || 0);
  const limit = estimateStepBudget(task);
  return used >= limit && !['verify', 'done', 'blocked'].includes(state.phase);
}

export function buildStepFrame(task = {}) {
  return `[STEP] guide=${estimateStepBudget(task)}; escalate=when evidence changes or proof is insufficient`;
}
