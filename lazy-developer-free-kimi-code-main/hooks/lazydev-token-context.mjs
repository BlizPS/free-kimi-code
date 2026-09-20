#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frame = 'Result first. Keep active context focused. Deduplicate repeated reads/calls. Compact stale observations before overflow. Preserve exact technical literals and acceptance criteria. No preamble, recap, praise, or process diary.';
const dir = process.env.LAZYDEV_CONTEXT_DIR || path.join(os.homedir(), '.lazydev');
try {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'token-frame.txt'), frame, { mode: 0o600 });
} catch {}
if (process.env.LAZYDEV_HOOK_STDOUT === '1') process.stdout.write(frame);
