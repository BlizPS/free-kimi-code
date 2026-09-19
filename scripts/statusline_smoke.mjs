import { spawnSync } from 'node:child_process';
import path from 'node:path';

const hook = path.resolve('hooks/lazydev-statusline.mjs');
const payload = {
  model: { name: 'z-ai/glm-5.2:free', display_name: 'GLM-5.2' },
  context_window: {
    used_percentage: 37.25,
    context_window_size: 32768,
    total_input_tokens: 999,
    total_output_tokens: 111,
    current_usage: { input_tokens: 3, cache_read_input_tokens: 4 },
  },
};
const out = spawnSync(process.execPath, [hook], { input: JSON.stringify(payload), encoding: 'utf8' });
if (out.status !== 0) throw new Error(out.stderr || 'statusline hook failed');
if (!/context:\s*37%/.test(out.stdout)) throw new Error(`expected live percentage, got: ${out.stdout}`);
if (!/\/32\.8k/.test(out.stdout)) throw new Error(`expected live context size, got: ${out.stdout}`);
const empty = spawnSync(process.execPath, [hook], { input: '{}', encoding: 'utf8' });
if (empty.status !== 0 || !/^context: 0$/.test(empty.stdout.trim())) throw new Error(`empty payload mismatch: ${empty.stdout}`);
console.log('statusline_smoke: PASS');
