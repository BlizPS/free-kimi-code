const RESPONSE_RULES = Object.freeze([
  'lead=result|action',
  'no=skill-narration,tool-diary,process-dump,praise,recap,filler',
  'state-once=decisions,blockers,proof',
  'preserve=technical-literals,negation,order,caveats',
  'expand=only-if-risk,ambiguity,user-request,required-detail',
]);

function responseBudget(task = {}) {
  if (task.simple) return 120;
  if (task.depth === 'deep') return 420;
  if (task.primary === 'security' || task.primary === 'debug') return 320;
  if (task.primary === 'ui' || task.primary === 'artifact') return 260;
  return 220;
}

export function buildResponseContractFrame(task = {}) {
  const mode = task.simple ? 'direct' : (task.depth || 'focused');
  return `[RESP] mode=${mode}; budget~${responseBudget(task)}; ${RESPONSE_RULES.join(';')}`;
}

export function getResponseBudget(task = {}) {
  return responseBudget(task);
}
