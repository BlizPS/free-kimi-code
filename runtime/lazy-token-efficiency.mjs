#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY_FILE = path.join(ROOT, 'runtime', 'lazy-efficiency.md');

function readEfficiencyPolicy() {
  try { return fs.readFileSync(POLICY_FILE, 'utf8').trim(); }
  catch { return 'Answer directly. Keep technical substance exact. Remove avoidable prose.'; }
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u;
const PROTECTED = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\bhttps?:\/\/\S+/gi,
  /(?:^|\s)[~^]?\/?[A-Za-z0-9_.-]+(?:[\\/]?[A-Za-z0-9_.-]+)+(?:\s|$)/g,
  /\b[A-Za-z_][A-Za-z0-9_]*\([^\n)]*\)/g,
  /\b[A-Z][A-Za-z0-9]*(?:_[A-Z][A-Za-z0-9]*)+\b/g,
  /\b\d+\.\d+\.\d+\b/g,
];

const FILLERS = /(?<![\w-])(?:just|really|basically|actually|simply|quite|very|essentially|literally)(?![\w-])/gi;
const HEDGES = /(?<![\w-])(?:perhaps|maybe|i think|in my opinion|it seems|it appears|could potentially|would like to)(?![\w-])\s*/gi;
const PLEASANTRIES = /(?<![\w-])(?:please|kindly|thank you|thanks|certainly|of course|happy to|i'?d be happy to)(?![\w-])[,.]?\s*/gi;
const SURE = /(?:^|(?<=[.!?]\s))sure\s*[,!.]\s*/gim;
const LEADERS = /^(?:i'?ll|i will|i can|i'?d|you can|we will|we can|let me|let'?s)\s+/gim;
const ARTICLES = /(?<![\w-])(?:a|an|the)\s+(?=[a-z])/gi;
const SENTINEL = /\u0000(\d+)\u0000/g;

function withProtected(text, transform) {
  const saved = [];
  let out = text;
  for (const re of PROTECTED) {
    re.lastIndex = 0;
    out = out.replace(re, (m) => {
      const i = saved.length;
      saved.push(m);
      return `\u0000${i}\u0000`;
    });
  }
  out = transform(out);
  for (let pass = 0; pass < 8; pass++) {
    SENTINEL.lastIndex = 0;
    if (!SENTINEL.test(out)) break;
    out = out.replace(SENTINEL, (_, i) => saved[Number(i)] ?? '');
  }
  return out;
}

function compressProse(text) {
  if (!text || CJK.test(text)) return text;
  return withProtected(text, (s) => {
    s = s.replace(LEADERS, '');
    s = s.replace(PLEASANTRIES, '');
    s = s.replace(SURE, '');
    s = s.replace(HEDGES, '');
    s = s.replace(FILLERS, '');
    s = s.replace(ARTICLES, '');
    s = s.replace(/[ \t]{2,}/g, ' ');
    s = s.replace(/\s+([,.;:!?])/g, '$1');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  });
}

export function compressContext(text) {
  const input = typeof text === 'string' ? text : String(text ?? '');
  if (!input) return { compressed: input, before: 0, after: 0, ratio: 0 };
  const compressed = compressProse(input);
  return {
    compressed,
    before: input.length,
    after: compressed.length,
    ratio: input.length ? 1 - (compressed.length / input.length) : 0,
  };
}

export { readEfficiencyPolicy };
