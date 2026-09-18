#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(root, 'runtime', 'lazy-efficiency.md');
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
let policy = 'Answer directly. Keep technical substance exact. Remove avoidable prose.';
try {
  const text = fs.readFileSync(policyPath, 'utf8').trim();
  if (text.length <= 12000) policy = text;
} catch {}
try {
  fs.mkdirSync(path.join(configDir, '.lazydev'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(configDir, '.lazydev', 'efficiency-active'), String(Date.now()), { mode: 0o600 });
} catch {}
process.stdout.write(`LAZY EFFICIENCY ACTIVE\n\n${policy}`);
