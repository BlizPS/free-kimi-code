import { computeTokenBudget } from '../budget.mjs';

export function buildKimiTokenConfig(input = {}) {
  const budget = computeTokenBudget(input);
  return [
    '[token_counting]',
    'strategy = "measured+estimated"',
    ``,
  ];
}

export function buildKimiTokenLoopSettings(input = {}) {
  const budget = computeTokenBudget(input);
  return {
    reserved_context_size: budget.reserve,
    compaction_trigger_ratio: budget.trigger,
    compaction_max_attempts: Math.max(1, Number(input.compactionAttempts) || 2),
  };
}

export function buildKimiTokenFrame(input = {}) {
  const budget = computeTokenBudget(input);
  return `[TOKEN] measured+estimated; reserve=${budget.reserve}; trigger=${budget.trigger.toFixed(2)}; compact=auto`;
}
