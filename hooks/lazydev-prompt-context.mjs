#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { classifyTask, resolveIntelligenceAliases } from '../runtime/intelligence-kernel.mjs';
import { generateDesignSystem } from '../systems/ui/pro/index.mjs';

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
if (task.primary === 'ui') {
  try {
    const ds = generateDesignSystem(prompt, { cwd: record.cwd });
    const out = {
      version: '1.0.0',
      task: prompt,
      generatedAt: Date.now(),
      stack: ds.stack,
      product: ds.resolution.product,
      pattern: ds.resolution.pattern,
      style: ds.resolution.style,
      palette: ds.resolution.palette,
      typography: ds.resolution.type,
      density: ds.resolution.density,
      motion: ds.resolution.motion,
      components: ds.components.slice(0, 6),
      uxRules: ds.uxRules.slice(0, 8),
      antiPatterns: ds.resolution.antiPatterns || [],
      decisionTrace: ds.trace,
    };
    fs.writeFileSync(path.join(home, 'lazydev-ui-context.json'), JSON.stringify(out, null, 2), { mode: 0o600 });
  } catch {}
}
try {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(record), { mode: 0o600 });
} catch {}
// Keep the hook non-interactive: record context for guards and diagnostics, but never write prompt directives to stdout.
// Kimi renders UserPromptSubmit stdout in the transcript, so emitting internal policy here would leak implementation details into the chat UI.
process.exit(0);
