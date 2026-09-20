#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
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
const nativePct = size > 0 ? Math.max(0, Math.min(100, (used / size) * 100)) : 0;
const virtualMultiplier = Math.max(1.25, Math.min(4, Number(process.env.LAZYDEV_CONTEXT_EXTRA_MULTIPLIER || 1.6)));
const virtualSize = size > 0 ? Math.max(size, Math.round(size * virtualMultiplier)) : 0;
const virtualPct = virtualSize > 0 ? Math.max(0, Math.min(100, (used / virtualSize) * 100)) : 0;
const model = String(data?.model?.display_name || data?.model?.name || '').trim();
let virtualStats = null;
try {
  const home = process.env.KIMI_CODE_HOME || path.join(process.env.HOME || process.cwd(), '.kimi-code');
  const snapshot = path.join(home, 'lazydev-virtual-context.json');
  virtualStats = fs.existsSync(snapshot)
    ? JSON.parse(fs.readFileSync(snapshot, 'utf8'))
    : null;
} catch {}
let meter = null;
try {
  const home = process.env.KIMI_CODE_HOME || path.join(process.env.HOME || process.cwd(), '.kimi-code');
  const meterPath = path.join(home, 'lazydev-context-meter.json');
  meter = fs.existsSync(meterPath) ? JSON.parse(fs.readFileSync(meterPath, 'utf8')) : null;
} catch {}
const active = Math.max(0, Number(meter?.activeTokens) || 0);
const turn = Math.max(0, Number(meter?.turnTokens) || 0);
const savings = Math.max(0, Math.min(1, Number(meter?.savingsRatio) || 0));
const fmtPct = (n) => {
  const pct = size > 0 ? Math.max(0, Math.min(100, (n / size) * 100)) : 0;
  return pct < 1 ? pct.toFixed(1) : pct.toFixed(pct >= 10 ? 0 : 1);
};
const virtualText = virtualStats?.capacityTokens
  ? `virtual: ${fmt(virtualStats.storedTokens || 0)}/${fmt(virtualStats.capacityTokens)} stored · ${virtualStats.lastHits || 0} hits`
  : (size > 0 ? `virtual: ${virtualPct.toFixed(virtualPct >= 10 ? 0 : 1)}% archive ${fmt(virtualSize)}` : '');
const activeText = size > 0
  ? `active: ${fmtPct(active)}% (${fmt(active)}/${fmt(size)})`
  : `active: ${fmt(active)}`;
const turnText = turn > 0 ? `turn: ${fmt(turn)}` : 'turn: 0';
const savingsText = savings > 0.005 ? `saved: ${(savings * 100).toFixed(0)}%` : '';
const suffix = [activeText, turnText, savingsText, virtualText].filter(Boolean).join(' · ');
const contextText = size > 0
  ? `context: ${nativePct.toFixed(nativePct >= 10 ? 0 : 1)}% (${fmt(Math.min(used, size))}/${fmt(size)}) total`
  : `context: ${fmt(used)} total`;
process.stdout.write(model ? `${contextText} · ${suffix} · ${model}` : `${contextText} · ${suffix}`);
