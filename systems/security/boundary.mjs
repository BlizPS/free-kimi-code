const SENSITIVE = /\b(api[_-]?key|token|secret|password|private[_-]?key|cookie|session)\b/i;
const EXTERNAL = /\b(url|web|http|https|remote|download|paste|external|user input)\b/i;

export function classifyBoundary(value = '') {
  const text = String(value || '');
  const sensitive = SENSITIVE.test(text);
  const external = EXTERNAL.test(text);
  return Object.freeze({ sensitive, external, trust: sensitive || external ? 'untrusted' : 'local' });
}

export function shouldRedact(value = '') {
  return SENSITIVE.test(String(value || ''));
}
