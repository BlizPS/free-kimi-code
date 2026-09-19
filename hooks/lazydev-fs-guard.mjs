#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';

const READ_MIN_CHARS = 1;
const WILDCARD_RE = /[*?\[\]{}]/u;
const WINDOWS_SYSTEM_RE = /^(?:[A-Za-z]:[\\/](?:Windows|Program Files(?: \(x86\))?|ProgramData|\$Recycle\.Bin|System Volume Information)(?:[\\/]|$)|\\\\[^\\]+\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:[\\/]|$))/iu;
const POSIX_ROOTS = new Set(['/','/bin','/sbin','/etc','/usr','/var','/opt','/System','/Library','/private']);

function isSystemPath(raw) {
  const value = String(raw || '');
  if (process.platform === 'win32') return WINDOWS_SYSTEM_RE.test(value.replaceAll('/', '\\'));
  const normalized = path.posix.normalize(value);
  return POSIX_ROOTS.has(normalized) || [...POSIX_ROOTS].some((root) => root !== '/' && normalized.startsWith(`${root}/`));
}

function block(message) {
  process.stderr.write(`LazyDev filesystem guard: ${message}\n`);
  process.exit(2);
}

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
let event;
try { event = JSON.parse(input || '{}'); } catch { process.exit(0); }
const name = String(event.tool_name || '');
const args = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};

if (name === 'Read') {
  if (args.max_chars !== undefined && (!Number.isFinite(Number(args.max_chars)) || Number(args.max_chars) < READ_MIN_CHARS)) {
    block('max_chars must be a positive integer when provided.');
  }
  if (isSystemPath(args.path)) {
    block('do not read operating-system directories. Read the project workspace or a specific user file instead.');
  }
}

if (name === 'Glob') {
  const pattern = String(args.pattern || '');
  const directory = String(args.directory || args.path || '');
  if (WILDCARD_RE.test(directory)) {
    block('Glob directory must not contain wildcards. Put wildcards in pattern and keep directory as a real directory path.');
  }
  if ((path.isAbsolute(pattern) || /^[A-Za-z]:[\\/]/u.test(pattern)) && WILDCARD_RE.test(pattern)) {
    block('Glob pattern must be relative, e.g. pattern=*.html with directory=<folder>; do not use an absolute wildcard path.');
  }
  if (isSystemPath(directory)) {
    block('do not Glob operating-system directories. Scope the search to the project directory.');
  }
  if (!directory && WILDCARD_RE.test(pattern) && (pattern.includes('/') || pattern.includes('\\'))) {
    block('Glob absolute paths are disabled. Use a real directory plus a relative pattern.');
  }
}

if (name === 'Grep' && isSystemPath(args.path)) {
  block('do not Grep operating-system directories. Scope the search to the project workspace.');
}
