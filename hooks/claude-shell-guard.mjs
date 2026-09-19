#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { platformPaths } from '../runtime/platform-policy.mjs';

function norm(p) { return path.resolve(String(p || '')); }
function artifactDir() { return process.env.LAZYDEV_ARTIFACT_DIR ? norm(process.env.LAZYDEV_ARTIFACT_DIR) : norm(platformPaths().artifactDirectory); }
function loadPrompt() {
  const dir = process.env.LAZYDEV_CONTEXT_DIR || path.join(os.homedir(), '.lazydev');
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'last-prompt.json'), 'utf8')); } catch { return {}; }
}
function artifactIntent(p) {
  return /(save|export|download|generate|create|produce|write|file|artifact|deliverable)/iu.test(p)
    && !/(edit|modify|refactor|fix|implement|source|repository|module|component|inside project|in the project)/iu.test(p);
}
function hasWorkspaceWrite(command, cwd) {
  const q = String(command || '');
  if (!q) return false;
  const patterns = [
    /(?:>|>>|tee|cat\s+[^|;&]*>)[\s]*["']?([^\s"'|;&]+\.(?:html?|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg|csv|md|txt))["']?/iu,
    /(?:cp|mv|copy|move)\s+[^\n]*?\s+(["']?[^\s"']+\.(?:html?|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg|csv|md|txt))["']?/iu,
    /(?:writeFileSync|writeFile|appendFileSync|appendFile)\s*\(\s*["']([^"']+\.(?:html?|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg|csv|md|txt))["']/iu,
    /(?:printf|echo|print)\b[^\n]*?(?:>|>>|tee)\s*["']?([^\s"']+\.(?:html?|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg|csv|md|txt))["']?/iu,
  ];
  return patterns.some((r) => {
    const m = q.match(r); if (!m) return false;
    const raw = m[1];
    const target = path.isAbsolute(raw) ? norm(raw) : norm(path.join(cwd, raw));
    return path.dirname(target) === norm(cwd) && !target.startsWith(artifactDir() + path.sep);
  });
}

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;
let event = {};
try { event = JSON.parse(raw); } catch { process.exit(0); }
const cmd = event.tool_input?.command || '';
const context = loadPrompt();
if ((Boolean(context.task?.artifact) || artifactIntent(context.prompt || '')) && hasWorkspaceWrite(cmd, event.cwd || process.cwd())) {
  const out = artifactDir();
  process.stderr.write(`BLOCKED by LazyDev: this shell command appears to create a standalone deliverable in the workspace root. Write it under ${out} instead, then verify the final path.\n`);
  process.exit(2);
}
process.exit(0);
