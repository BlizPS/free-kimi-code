#!/usr/bin/env node
let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;
let data = {};
try { data = JSON.parse(raw || '{}'); } catch { data = {}; }

const ctx = data?.context_window || {};
let size = Number(ctx.context_window_size) || Number(data?.model?.context_window_size) || 0;
let used = null;
// Kimi's context usage percentage is the window occupancy signal.
// current_usage is only the latest-call snapshot, so it is not used as the primary context value.
if (Number.isFinite(Number(ctx.used_percentage)) && size > 0) used = Math.round(size * Number(ctx.used_percentage) / 100);
if (used == null) {
  const usage = ctx.current_usage;
  if (usage && typeof usage === 'object') {
    const n = Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0);
    if (n > 0) used = n;
  }
}
if (used == null) used = Number(ctx.total_input_tokens || 0) + Number(ctx.total_output_tokens || 0);
used = Math.max(0, used);

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}
const pct = size > 0 ? Math.max(0, Math.min(100, (used / size) * 100)) : 0;
const model = String(data?.model?.display_name || data?.model?.name || '').trim();
const contextText = size > 0 ? `context: ${pct.toFixed(pct >= 10 ? 0 : 1)}% (${fmt(Math.min(used, size))}/${fmt(size)})` : `context: ${fmt(used)}`;
process.stdout.write(model ? `${contextText} · ${model}` : contextText);
