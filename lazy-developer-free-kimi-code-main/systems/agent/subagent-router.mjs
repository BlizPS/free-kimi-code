const ROLES = Object.freeze(['explore', 'plan', 'coder']);

export function chooseSubagents(task = {}) {
  const primary = String(task.primary || 'implementation');
  const complexity = Number(task.complexity || 0);
  const deep = task.depth === 'deep' || complexity >= 62;
  const roles = [];

  if (deep || ['debug', 'review', 'ui', 'security'].includes(primary)) roles.push('explore');
  if (task.plan || ['ui', 'debug', 'security', 'review'].includes(primary)) roles.push('plan');
  roles.push('coder');
  return [...new Set(roles)].filter((role) => ROLES.includes(role));
}

export function buildSubagentBrief(role, task = {}, scope = '') {
  const safeRole = ROLES.includes(role) ? role : 'coder';
  const taskText = String(task.text || task.task || '').trim();
  const scopeText = String(scope || '').trim();
  const roleRules = {
    explore: 'Read-only reconnaissance. Map ownership, relevant files, dependencies, current behavior, and concrete evidence. Do not edit.',
    plan: 'Produce a concrete implementation sequence, affected files, acceptance checks, and risks. Do not edit unless explicitly delegated as implementation.',
    coder: 'Implement the approved scope using existing seams. Preserve unrelated behavior, keep the diff focused, and verify the result.',
  };
  return [
    `role=${safeRole}`,
    roleRules[safeRole],
    `task=${taskText}`,
    scopeText ? `scope=${scopeText}` : '',
    'Return only durable findings, changed paths, blockers, and proof needed by the parent agent.',
  ].filter(Boolean).join('\n');
}

export function buildAgentFrame(task = {}) {
  return `[AGENT] roles=${chooseSubagents(task).join(',')}; isolation=focused-context; handoff=durable-findings-only`;
}
