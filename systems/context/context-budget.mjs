export function computeContextBudget(input = {}) {
  // `max` is the model's real context window. Optimize output separately.
  const max = Math.max(1024, Number(input.maxTokens || input.contextLimit || input.contextLength || 16384));
  const rawOutput = Math.max(256, Number(input.outputTokens || input.outputLimit || 8192));
  const outputFraction = max <= 8192 ? 0.20 : max <= 131072 ? 0.25 : 0.20;
  const output = Math.max(256, Math.min(rawOutput, Math.floor(max * outputFraction), 32768));
  const reserve = Math.max(768, Math.min(output, Math.floor(max * 0.25)));
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
