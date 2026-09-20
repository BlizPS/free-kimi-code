#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { platformPaths } from '../runtime/platform-policy.mjs';

const EXTENSIONS = new Set(['.html','.htm','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip','.png','.jpg','.jpeg','.webp','.gif','.svg','.csv','.md','.txt']);
const ARTIFACT_INTENT = /\b(save|export|download|generate|create|produce|write|artifact|deliverable|make|build|simpan|menyimpan|unduh|hasilkan|buat|bikin|buatin|buatkan|bikinin)\b/iu;
const PROJECT_MARKERS = ['.git','package.json','pyproject.toml','go.mod','go.work','Cargo.toml','tsconfig.json','requirements.txt'];
function norm(p) { return path.resolve(String(p || '')); }
function artifactDir() { return norm(process.env.LAZYDEV_ARTIFACT_DIR || platformPaths().artifactDirectory); }
function inside(target, root) { const a=norm(target), b=norm(root); return a===b || a.startsWith(`${b}${path.sep}`); }
function projectRoot(cwd) { return PROJECT_MARKERS.some(name => fs.existsSync(path.join(cwd, name))); }
function loadPrompt() {
  const home = process.env.LAZYDEV_CONTEXT_DIR || process.env.KIMI_CODE_HOME || path.join(os.homedir(), '.lazydev');
  try { return JSON.parse(fs.readFileSync(path.join(home, 'last-prompt.json'), 'utf8'))?.prompt || ''; } catch { return ''; }
}
function shouldRoute(target, cwd, prompt) {
  if (!EXTENSIONS.has(path.extname(target).toLowerCase())) return false;
  const out = artifactDir();
  if (inside(target, out)) return false;
  const segments = norm(target).split(path.sep).filter(Boolean).map(x => x.toLowerCase());
  if (segments.includes('lazydevfile')) return true;
  if (!ARTIFACT_INTENT.test(prompt)) return false;
  if (path.dirname(target) === cwd && projectRoot(cwd)) return false;
  return path.dirname(target) === cwd || path.dirname(target) === norm(os.homedir());
}
function availableName(dir, raw) {
  const ext = path.extname(raw), stem = raw.slice(0, raw.length - ext.length);
  let candidate = path.join(dir, raw), i = 1;
  while (fs.existsSync(candidate)) candidate = path.join(dir, `${stem}-${i++}${ext}`);
  return candidate;
}
async function main() {
  let raw=''; process.stdin.setEncoding('utf8'); for await (const chunk of process.stdin) raw += chunk;
  let event={}; try { event=JSON.parse(raw || '{}'); } catch { return; }
  const tool = String(event.tool_name || ''); if (!['Write','WriteFile'].includes(tool)) return;
  const input = event.tool_input || {}; const rawTarget = input.file_path || input.path || input.filename; if (!rawTarget) return;
  const cwd = norm(event.cwd || process.cwd());
  let target = String(rawTarget);
  target = path.isAbsolute(target) ? norm(target) : norm(path.join(cwd, target));
  try { if (!fs.statSync(target).isFile()) return; } catch { return; }
  const prompt = loadPrompt(); if (!shouldRoute(target, cwd, prompt)) return;
  const out = artifactDir(); fs.mkdirSync(out, { recursive: true });
  const dest = availableName(out, path.basename(target));
  try { fs.renameSync(target, dest); } catch { try { fs.copyFileSync(target, dest); fs.unlinkSync(target); } catch { return; } }
  process.stdout.write(`LazyDev artifact router: saved standalone deliverable at ${dest}.\n`);
}
main().catch(() => {});
