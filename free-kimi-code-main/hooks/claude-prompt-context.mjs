#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { classifyTask, resolveIntelligenceAliases } from '../runtime/intelligence-kernel.mjs';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
let data = {};
try { data = JSON.parse(input); } catch { process.exit(0); }

function promptText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.filter((part) => part && part.type === 'text').map((part) => part.text || '').join(' ').trim();
}

const prompt = promptText(data.prompt || data.message || data.user_prompt);
const model = String(data.model || process.env.LAZYDEV_MODEL || '');
const task = classifyTask(prompt, model);
const record = {
  event: String(data.hook_event_name || 'UserPromptSubmit'),
  sessionId: data.session_id || null,
  cwd: data.cwd || process.cwd(),
  prompt,
  model,
  aliases: resolveIntelligenceAliases(task),
  task,
  at: Date.now(),
};

const dir = process.env.LAZYDEV_CONTEXT_DIR || path.join(os.homedir(), '.lazydev');
const file = path.join(dir, 'last-prompt.json');
try {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(record), { mode: 0o600 });
} catch {}
