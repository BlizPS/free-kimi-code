#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;
let data = {};
try { data = JSON.parse(raw || '{}'); } catch { data = {}; }

const ctx = data?.context_window || {};
const size = Number(ctx.context_window_size) || Number(data?.model?.context_window_size) || 0;
const rawPct = Number(ctx.used_percentage);
const saneNativePct = Number.isFinite(rawPct) && rawPct >= 0 && rawPct <= 100 ? rawPct : null;
let nativeUsed = saneNativePct != null && size > 0 ? Math.round(size * saneNativePct / 100) : null;
if (nativeUsed == null) {
  const usage = ctx.current_usage;
  if (usage && typeof usage === 'object') {
    const n = Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0);
    if (n > 0) nativeUsed = n;
  }
}
if (nativeUsed == null) nativeUsed = Number(ctx.total_input_tokens || 0) + Number(ctx.total_output_tokens || 0);
nativeUsed = Math.max(0, nativeUsed || 0);

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}
function percent(used, capacity) {
  if (!(capacity > 0)) return 0;
  return Math.max(0, Math.min(100, (Math.max(0, used) / capacity) * 100));
}
function pctText(pct) {
  return pct < 1 ? pct.toFixed(1) : pct.toFixed(pct >= 10 ? 0 : 1);
}

const model = String(data?.model?.display_name || data?.model?.name || '').trim();
let virtualStats = null;
let meter = null;
try {
  const home = process.env.KIMI_CODE_HOME || path.join(process.env.HOME || process.cwd(), '.kimi-code');
  const snapshot = path.join(home, 'lazydev-virtual-context.json');
  const meterPath = path.join(home, 'lazydev-context-meter.json');
  virtualStats = fs.existsSync(snapshot) ? JSON.parse(fs.readFileSync(snapshot, 'utf8')) : null;
  meter = fs.existsSync(meterPath) ? JSON.parse(fs.readFileSync(meterPath, 'utf8')) : null;
} catch {}

const meterAge = meter?.at ? Math.max(0, Date.now() - Number(meter.at)) : Infinity;
const meterModel = String(meter?.model || '').trim();
const meterContext = Number(meter?.nativeContext) || 0;
const meterActive = Math.max(0, Number(meter?.activeTokens) || 0);
const meterFresh = meterAge <= 120000 && meterContext > 0 && (!meterModel || !process.env.LAZYDEV_MODEL || meterModel === process.env.LAZYDEV_MODEL);
const displayUsed = meterFresh ? meterActive : nativeUsed;
const displaySize = meterFresh ? meterContext : size;
const displayPct = percent(displayUsed, displaySize);
const wirePct = percent(nativeUsed, size);
const turn = Math.max(0, Number(meter?.turnTokens) || 0);
const savings = Math.max(0, Math.min(1, Number(meter?.savingsRatio) || 0));
const virtualMultiplier = Math.max(1.25, Math.min(4, Number(process.env.LAZYDEV_CONTEXT_EXTRA_MULTIPLIER || 2)));
const virtualSize = size > 0 ? Math.max(size, Math.round(size * virtualMultiplier)) : 0;

const contextText = displaySize > 0
  ? `context: ${pctText(displayPct)}% (${fmt(Math.min(displayUsed, displaySize))}/${fmt(displaySize)}) active`
  : `context: ${fmt(displayUsed)} active`;
const wireText = meterFresh && size > 0 && Math.abs(wirePct - displayPct) >= 1
  ? `wire: ${pctText(wirePct)}%`
  : '';
const activeText = displaySize > 0 ? `active: ${pctText(displayPct)}%` : '';
const turnText = turn > 0 ? `turn: ${fmt(turn)}` : 'turn: 0';
const savingsText = savings > 0.005 ? `saved: ${(savings * 100).toFixed(0)}%` : '';
const virtualText = virtualStats?.capacityTokens
  ? `virtual: ${fmt(virtualStats.storedTokens || 0)}/${fmt(virtualStats.capacityTokens)} stored · ${virtualStats.lastHits || 0} hits`
  : (virtualSize > 0 ? `virtual: ${pctText(percent(nativeUsed, virtualSize))}% archive ${fmt(virtualSize)}` : '');
const suffix = [activeText, turnText, savingsText, wireText, virtualText].filter(Boolean).join(' · ');
process.stdout.write(model ? `${contextText} · ${suffix} · ${model}` : `${contextText} · ${suffix}`);
