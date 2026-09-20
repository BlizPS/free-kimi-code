const TRANSIENT_STATUSES = Object.freeze(new Set([408, 409, 425, 429, 500, 502, 503, 504]));
const TRANSIENT_TEXT = /(?:temporar(?:ily|y)\s+overload(?:ed)?|service\s+unavailable|server\s+overload|too\s+many\s+requests|rate[_ -]?limit(?:ed)?|resource\s+exhausted|try\s+again\s+later|capacity\s+exceeded|upstream\s+unavailable)/i;

export function isTransientProviderFailure({ status = 0, message = '', body = '' } = {}) {
  const code = Number(status) || 0;
  if (TRANSIENT_STATUSES.has(code)) return true;
  return TRANSIENT_TEXT.test(`${message}\n${body}`);
}

export function retryAfterMs(headers = {}) {
  const raw = headers?.['retry-after'] ?? headers?.get?.('retry-after');
  if (raw == null) return 0;
  const value = String(raw).trim();
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(30000, Math.round(seconds * 1000));
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, Math.min(30000, date - Date.now()));
  return 0;
}

export function transientRetryDelayMs(attempt = 0, headers = {}, options = {}) {
  const n = Math.max(0, Number(attempt) || 0);
  const retryAfter = retryAfterMs(headers);
  if (retryAfter > 0) return retryAfter;
  const base = Math.max(250, Number(options.baseMs) || 800);
  const cap = Math.max(base, Number(options.maxMs) || 8000);
  const jitter = Math.max(0, Math.min(0.5, Number(options.jitter) || 0));
  const exponential = Math.min(cap, base * (2 ** n));
  const factor = jitter ? 1 - jitter + Math.random() * jitter * 2 : 1;
  return Math.min(cap, Math.max(0, Math.round(exponential * factor)));
}

export function shouldRetryTransient({ status = 0, message = '', body = '', attempt = 0, maxRetries = 2, committed = false } = {}) {
  if (committed || attempt >= Math.max(0, Number(maxRetries) || 0)) return false;
  return isTransientProviderFailure({ status, message, body });
}

export function buildTransientFailureMessage({ provider = 'Provider', model = '', status = 503, attempts = 1, detail = '' } = {}) {
  const suffix = model ? ` for ${model}` : '';
  const detailText = detail ? ` Detail: ${String(detail).replace(/\s+/g, ' ').trim().slice(0, 240)}` : '';
  return `${provider} is temporarily unavailable${suffix} (HTTP ${Number(status) || 503}). LazyDev retried ${Math.max(1, Number(attempts) || 1)} time(s) before stopping.${detailText}`;
}

export { TRANSIENT_STATUSES };
