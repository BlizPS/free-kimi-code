export function computeContextBudget(input = {}) {
  const max = Math.max(16384, Number(input.maxTokens || input.contextLimit || 131072));
  const output = Math.max(2048, Number(input.outputTokens || input.outputLimit || 8192));
  const reserve = Math.min(49152, Math.max(12000, Math.round(Math.max(output * 2, max * 0.08))));
  const inputBudget = Math.max(8192, max - reserve);
  return Object.freeze({ max, output, reserve, input: inputBudget });
}

export function allocateContextBudget(input = {}, weights = {}) {
  const total = Math.max(1, Number(input.input || 1));
  const entries = Object.entries(weights).filter(([, value]) => Number(value) > 0);
  const weightTotal = entries.reduce((sum, [, value]) => sum + Number(value), 0) || 1;
  return Object.fromEntries(entries.map(([key, value]) => [
    key,
    Math.max(128, Math.floor(total * Number(value) / weightTotal)),
  ]));
}
