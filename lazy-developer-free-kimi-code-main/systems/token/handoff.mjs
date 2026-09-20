import { compactText } from './compaction.mjs';

export function buildCompactHandoff(input = {}, options = {}) {
  const maxTokens = Math.max(120, Number(options.maxTokens) || 700);
  const rows = [
    ['task', input.task],
    ['findings', input.findings],
    ['changed', input.changed],
    ['proof', input.proof],
    ['blockers', input.blockers],
    ['next', input.next],
  ];
  let output = '';
  for (const [key, value] of rows) {
    const text = Array.isArray(value) ? value.join('; ') : String(value ?? '').trim();
    if (!text) continue;
    const part = `${key}=${compactText(text, Math.max(60, Math.floor(maxTokens / 6)))};`;
    if ((output.length + part.length) / 4 > maxTokens) break;
    output += part;
  }
  return output.replace(/;$/,'');
}
