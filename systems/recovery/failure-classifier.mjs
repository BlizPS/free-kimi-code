const PATTERNS = Object.freeze([
  ['authentication', /\b(401|403|unauthorized|forbidden|invalid api key|authentication)\b/i],
  ['rate_limit', /\b(429|rate limit|too many requests|quota)\b/i],
  ['context', /\b(context window|too many tokens|maximum context|prompt too long|context length)\b/i],
  ['timeout', /\b(timeout|timed out|deadline)\b/i],
  ['network', /\b(connection|network|dns|socket|econnreset|enotfound)\b/i],
  ['tool', /\b(tool|command|exit code|permission denied|no such file|not found)\b/i],
  ['syntax', /\b(syntax error|parse error|type error|compile error|build failed)\b/i],
]);

export function classifyFailure(error) {
  const text = String(error?.message || error || '').trim();
  const match = PATTERNS.find(([, pattern]) => pattern.test(text));
  const kind = match?.[0] || 'unknown';
  const retryable = ['rate_limit', 'context', 'timeout', 'network'].includes(kind);
  const repairable = ['context', 'tool', 'syntax', 'unknown'].includes(kind);
  return Object.freeze({ kind, text, retryable, repairable });
}

export function recoveryAction(failure, attempt = 0) {
  const current = failure?.kind || classifyFailure(failure).kind;
  if (current === 'authentication' || attempt >= 2) return 'stop';
  if (current === 'context') return 'compact-and-retry';
  if (current === 'tool' || current === 'syntax') return 'repair-and-verify';
  if (['rate_limit', 'timeout', 'network'].includes(current)) return 'retry';
  return 'inspect-and-repair';
}
