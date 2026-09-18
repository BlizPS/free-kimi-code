#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
try {
  if (!fs.existsSync(path.join(configDir, '.lazydev', 'efficiency-active'))) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: 'Keep reply terse. No preamble or recap. Preserve code, exact errors, negation, and sequence. Expand grammar when safety or order needs it.'
    }
  }));
} catch {}
