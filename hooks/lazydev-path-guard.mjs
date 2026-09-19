#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { platformPaths } from '../runtime/platform-policy.mjs';
import { nextAvailableArtifactName } from '../runtime/artifact-naming.mjs';

function norm(p) { return path.resolve(String(p || '')); }
function inside(target, root) {
  const a = norm(target), b = norm(root);
  return a === b || a.startsWith(b + path.sep);
}
function artifactDir() { return process.env.LAZYDEV_ARTIFACT_DIR ? norm(process.env.LAZYDEV_ARTIFACT_DIR) : norm(platformPaths().artifactDirectory); }
function loadContext() {
  const home = process.env.KIMI_CODE_HOME || path.join(process.env.HOME || process.cwd(), '.kimi-code');
  try { return JSON.parse(fs.readFileSync(path.join(home, 'lazydev-last-prompt.json'), 'utf8')); } catch { return {}; }
}
function explicitArtifactPrompt(prompt) {
  const p = String(prompt || '').toLowerCase();
  return /(save|export|download|generate|create|produce|write|file|artifact|deliverable)/u.test(p)
    && !/(edit|modify|refactor|fix|implement|source|repository|module|component|inside project|in the project)/u.test(p);
}
function getPath(input) {
  return String(input?.file_path || input?.path || input?.filename || '');
}
async function main() {
  let raw=''; process.stdin.setEncoding('utf8'); for await (const chunk of process.stdin) raw += chunk;
  let event={}; try { event=JSON.parse(raw); } catch { process.exit(0); }
  const input=event.tool_input || {};
  const target=getPath(input);
  if (!target) process.exit(0);
  const cwd=norm(event.cwd || process.cwd());
  const out=artifactDir();
  const resolved=norm(target);
  const ctx=loadContext();
  const implied=Boolean(ctx.task?.artifact) || explicitArtifactPrompt(ctx.prompt || '');
  const standaloneExt=/\.(?:html?|pdf|docx?|xlsx?|pptx?|zip|ahk|png|jpe?g|webp|gif|svg|csv|md|txt)$/iu.test(resolved);
  const workspaceRootFile=path.dirname(resolved) === cwd;
  const toolName=String(event.tool_name || '');
  const artifactSegment=path.basename(out);
  const pathSegments=resolved.split(path.sep).filter(Boolean);
  const looksLikeArtifactAlias=pathSegments.includes(artifactSegment) && !inside(resolved,out);
  // Misplaced standalone files are recoverable: the PostToolUse artifact
  // router moves successful Write/WriteFile outputs to the canonical path.
  // Keep this pre-tool hook focused on collision protection.
  if (implied && /^(?:Write|WriteFile)$/u.test(toolName) && inside(resolved, out) && fs.existsSync(resolved)) {
    const nextName = nextAvailableArtifactName(out, path.basename(resolved));
    process.stderr.write(`BLOCKED by LazyDev: the standalone deliverable already exists at ${resolved}. Keep the existing file untouched and retry Write with ${path.join(out, nextName)}. Do not claim success until that exact new path is verified.\n`);
    process.exit(2);
  }
  process.exit(0);
}
main().catch(() => process.exit(0));
