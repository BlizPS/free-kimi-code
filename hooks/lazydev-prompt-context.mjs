#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { classifyTask, buildTaskContext, resolveIntelligenceAliases } from '../runtime/intelligence-kernel.mjs';

const home = process.env.KIMI_CODE_HOME || path.join(process.env.HOME || process.cwd(), '.kimi-code');
const file = path.join(home, 'lazydev-last-prompt.json');
let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
let data = {};
try { data = JSON.parse(input); } catch {}
function promptText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter((part) => part && part.type === 'text').map((part) => part.text || '').join(' ').trim();
}
const prompt = promptText(data.prompt);
const model = String(data.model || process.env.LAZYDEV_MODEL || '');
const task = classifyTask(prompt, model);
const record = {
  event: String(data.hook_event_name || 'TurnStarted'),
  sessionId: data.session_id || null,
  cwd: data.cwd || process.cwd(),
  prompt,
  model,
  aliases: resolveIntelligenceAliases(task),
  task,
  at: Date.now(),
};
try {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(record), { mode: 0o600 });
} catch {}
// Intentionally silent: this hook is an observer. Kimi Code does not need stdout for it.
