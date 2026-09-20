const RETRYABLE = new Set(['rate_limit', 'timeout', 'network']);
const MAX_ATTEMPTS = 2;

export function retryDelayMs(attempt, kind = 'unknown') {
  const n = Math.max(0, Number(attempt) || 0);
  const base = kind === 'rate_limit' ? 1500 : 500;
  return Math.min(15000, base * (2 ** n));
}

export function nextRetry(failure = {}, attempt = 0, state = {}) {
  const kind = String(failure.kind || 'unknown');
  const used = Math.max(0, Number(attempt) || 0);
  const committed = Boolean(state.committed);
  if (!RETRYABLE.has(kind) || committed || used >= MAX_ATTEMPTS) {
    return { retry: false, delayMs: 0, reason: committed ? 'stream-committed' : 'retry-budget-exhausted-or-nonretryable' };
  }
  return { retry: true, delayMs: retryDelayMs(used, kind), reason: kind };
}

export function buildRecoveryFrame() {
  return '[RECOVERY] classify failure first; compact context before context-limit retry; repair tool/syntax failures; never repeat a committed stream blindly';
}
