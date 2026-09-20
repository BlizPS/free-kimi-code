const COMMON = ['syntax-or-type-check', 'focused-behavior-check'];

export function selectVerificationPlan(task = {}) {
  const primary = String(task.primary || 'implementation');
  const checks = [...COMMON];
  if (primary === 'ui') checks.push('render', 'narrow-width', 'keyboard-or-touch');
  if (primary === 'artifact') checks.push('exact-path', 'artifact-open');
  if (primary === 'debug') checks.push('reproduction', 'regression-check');
  if (primary === 'security') checks.push('boundary-check', 'negative-case');
  if (primary === 'review') checks.push('diff-scope', 'regression-scan');
  return [...new Set(checks)];
}

export function buildVerificationFrame(task = {}) {
  return `[VERIFY] checks=${selectVerificationPlan(task).join(',')}; claim only proven checks`;
}
