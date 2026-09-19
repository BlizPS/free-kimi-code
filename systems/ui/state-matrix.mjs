const BASE_STATES = Object.freeze(['idle', 'loading', 'success', 'empty', 'error', 'disabled']);

export function stateMatrix(options = {}) {
  const states = [...BASE_STATES];
  if (options.interactive !== false) states.push('focus', 'hover', 'pressed');
  if (options.async) states.push('retrying');
  return [...new Set(states)];
}

export function missingStates(existing = [], options = {}) {
  const have = new Set(existing.map((item) => String(item).toLowerCase()));
  return stateMatrix(options).filter((state) => !have.has(state));
}
