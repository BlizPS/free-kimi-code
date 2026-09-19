const ACTIONS = /\b(implement|add|fix|change|remove|build|create|modify|refactor|make)\b/i;
const PROOF = /\b(test|verify|validate|check|confirm|preview|render|build|lint|smoke)\b/i;

export function deriveAcceptance(task = {}) {
  const text = String(task.text || task || '').trim();
  const clauses = text.split(/\n|\.|;|\bthen\b|\band\b/i).map((item) => item.trim()).filter(Boolean);
  const observable = clauses.filter((item) => ACTIONS.test(item)).slice(0, 6);
  return {
    required: observable.length ? observable : [text].filter(Boolean),
    explicitProof: PROOF.test(text),
    minimum: task.primary === 'ui' ? ['render', 'responsive'] : ['targeted-check'],
  };
}

export function acceptanceStatus(acceptance, checks = []) {
  const required = Array.isArray(acceptance?.minimum) ? acceptance.minimum : [];
  const passed = new Set(checks.filter((item) => item?.ok).map((item) => String(item.name)));
  const missing = required.filter((name) => !passed.has(name));
  return {
    complete: missing.length === 0,
    passed: [...passed],
    missing,
  };
}
