import crypto from 'node:crypto';

export function fingerprint(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  const hash = crypto.createHash('sha256');
  hash.write(text);
  return hash.digest('hex').slice(0, 16);
}

export function sameFingerprint(left, right) {
  return fingerprint(left) === fingerprint(right);
}
