export function computeContextBudget(input = {}) {
  const max = Math.max(1024, Number(input.maxTokens || input.contextLimit || 16384));
  const rawOutput = Math.max(256, Number(input.outputTokens || input.outputLimit || 8192));
  const output = Math.max(256, Math.min(rawOutput, Math.floor(max * 0.25), 16384));
  const reserve = max > 4096
    ? Math.min(Math.max(1024, output), Math.max(1024, Math.floor(max / 4)))
    : Math.max(512, Math.floor(max / 6));
  const inputBudget = Math.max(1024, max - reserve);
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
