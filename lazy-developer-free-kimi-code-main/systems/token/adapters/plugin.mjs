export function buildPluginTokenDirective() {
  return 'Token system: use progressive disclosure; keep the active context limited to task, constraints, decisions, evidence, changed paths, and unresolved risks; compact repeated observations; preserve exact technical literals.';
}

export function buildPluginTokenContract() {
  return Object.freeze({
    loading: 'progressive-disclosure',
    context: 'task+constraints+decisions+evidence+changes+risks',
    output: 'result-first',
    preserve: ['code', 'paths', 'urls', 'identifiers', 'versions', 'errors', 'negation', 'order'],
  });
}
