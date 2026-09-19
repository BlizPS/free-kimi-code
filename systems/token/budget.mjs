const DEFAULTS = Object.freeze({
  reserveRatio: 0.08,
  reserveFloor: 12000,
  inputFloor: 8192,
});

export function computeTokenBudget(input = {}) {
  const max = Math.max(16384, Number(input.maxContext ?? input.contextLimit ?? 131072));
  const output = Math.max(1024, Number(input.maxOutput ?? input.outputLimit ?? 8192));
  const reserve = Math.min(
    Math.max(DEFAULTS.reserveFloor, output * 2),
    Math.max(16384, Math.round(max * (Number(input.reserveRatio) || DEFAULTS.reserveRatio))),
  );
  const inputBudget = Math.max(DEFAULTS.inputFloor, max - reserve);
  const trigger = Math.min(0.94, Math.max(0.72, Number(input.compactionRatio) || 0.88));
  return Object.freeze({ max, output, reserve, input: inputBudget, trigger });
}

export function allocateTokenBudget(total, weights = {}, floors = {}) {
  const budget = Math.max(1, Number(total) || 1);
  const entries = Object.entries(weights).filter(([, value]) => Number(value) > 0);
  const sum = entries.reduce((n, [, value]) => n + Number(value), 0) || 1;
  const raw = Object.fromEntries(entries.map(([key, value]) => [key, budget * Number(value) / sum]));
  const result = {};
  let used = 0;
  for (const [key] of entries) {
    const floor = Math.max(0, Number(floors[key]) || 0);
    result[key] = Math.max(floor, Math.floor(raw[key]));
    used += result[key];
  }
  if (used > budget) {
    const scale = budget / used;
    for (const key of Object.keys(result)) result[key] = Math.max(0, Math.floor(result[key] * scale));
  }
  return result;
}

export function shouldCompact(usage = {}) {
  const max = Math.max(1, Number(usage.max ?? usage.contextLimit) || 1);
  const used = Math.max(0, Number(usage.used ?? usage.inputTokens) || 0);
  const reserve = Math.max(0, Number(usage.reserve) || 0);
  const ratio = Math.min(0.99, Math.max(0.5, Number(usage.trigger ?? usage.compactionRatio) || 0.88));
  return used >= max * ratio || max - used <= reserve;
}

export function remainingTokens(usage = {}) {
  const max = Math.max(0, Number(usage.max ?? usage.contextLimit) || 0);
  const used = Math.max(0, Number(usage.used ?? usage.inputTokens) || 0);
  return Math.max(0, max - used);
}
