const PHASES = Object.freeze([
  'intake',
  'inspect',
  'research',
  'plan',
  'implement',
  'verify',
  'repair',
  'done',
  'blocked',
]);

const TRANSITIONS = Object.freeze({
  intake: ['inspect', 'research', 'plan', 'implement', 'blocked'],
  inspect: ['research', 'plan', 'implement', 'verify', 'blocked'],
  research: ['plan', 'inspect', 'implement', 'blocked'],
  plan: ['implement', 'inspect', 'research', 'blocked'],
  implement: ['verify', 'repair', 'blocked'],
  verify: ['done', 'repair', 'blocked'],
  repair: ['verify', 'implement', 'blocked'],
  done: [],
  blocked: [],
});

export function phases() {
  return [...PHASES];
}

export function canTransition(from, to) {
  return TRANSITIONS[String(from)]?.includes(String(to)) === true;
}

export function createTaskState(input = {}) {
  return {
    id: String(input.id || ''),
    phase: PHASES.includes(input.phase) ? input.phase : 'intake',
    task: String(input.task || ''),
    step: 0,
    attempts: 0,
    evidence: [],
    changes: [],
    risks: [],
    history: [],
  };
}

export function transition(state, next, reason = '') {
  if (!state || !canTransition(state.phase, next)) {
    return { ok: false, state };
  }
  const history = Array.isArray(state.history) ? [...state.history] : [];
  history.push({ from: state.phase, to: next, reason: String(reason || '') });
  return {
    ok: true,
    state: {
      ...state,
      phase: next,
      step: Number(state.step || 0) + 1,
      history,
    },
  };
}

export function noteEvidence(state, text, kind = 'fact') {
  const value = String(text || '').trim();
  if (!value) return state;
  const evidence = [...(state.evidence || [])];
  if (!evidence.some((item) => item.text === value)) evidence.push({ text: value, kind });
  return { ...state, evidence };
}

export function noteChange(state, file, summary = '') {
  const path = String(file || '').trim();
  if (!path) return state;
  const changes = [...(state.changes || [])];
  const existing = changes.findIndex((item) => item.file === path);
  const next = { file: path, summary: String(summary || '') };
  if (existing >= 0) changes[existing] = next;
  else changes.push(next);
  return { ...state, changes };
}

export function noteRisk(state, text, severity = 'medium') {
  const value = String(text || '').trim();
  if (!value) return state;
  const risks = [...(state.risks || [])];
  if (!risks.some((item) => item.text === value)) risks.push({ text: value, severity });
  return { ...state, risks };
}
