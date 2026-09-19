#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import { platformPaths } from '../runtime/platform-policy.mjs';
import { modelIntelligenceProfile, buildIntelligenceAliasSystem } from '../runtime/intelligence-kernel.mjs';
import { buildReasoningScaffoldFrame } from '../systems/intelligence/reasoning-scaffold.mjs';
import { isTransientProviderFailure, shouldRetryTransient, transientRetryDelayMs, retryAfterMs, buildTransientFailureMessage } from '../runtime/provider-resilience.mjs';
import { buildUiSystemPrompt } from '../runtime/ui-intelligence.mjs';
import { buildNativeSystemsPrompt } from '../systems/index.mjs';
import { buildKimiTokenConfig } from '../systems/token/adapters/kimi.mjs';
import { extractSessionModelAliases } from '../runtime/session-model-compat.mjs';
import { repairOpenAIHistory } from '../runtime/openai-history.mjs';
import { generateDesignSystem } from '../systems/ui/pro/index.mjs';
import { buildLanguageFrame, getLanguageReport } from '../systems/languages/index.mjs';
import { buildGeminiRetryRequest, chunkFinishReason, chunkHasVisibleOutput, geminiOpenAIEndpoint, parseSseEvent, prepareGeminiRequest, responseHasUsableOutput, streamNeedsGeminiRetry } from '../runtime/gemini-resilience.mjs';
import { compressAgenticMessages, FOVEANCE_DEFAULTS } from '../systems/token/foveance.mjs';

const version = '1.0.0';
const TOKEN_SAVINGS_FLOOR = 0.75;
const TOKEN_SAVINGS_TARGET = 0.80;
const MAX_SKILL_FRACTION = 0.24;
const KIMI_PACKAGE = '@moonshot-ai/kimi-code';
const KIMI_VERSION = '2.0.0';
const OPENROUTER_FREE_MODEL = 'openrouter/free';
const OPENROUTER_MODEL_FALLBACK_LIMIT = 3;
const GEMINI_NO_TOOL_MODELS = [];
const PROVIDER_TRANSIENT_MAX_RETRIES = Math.max(0, Math.min(4, Number(process.env.LAZYDEV_TRANSIENT_RETRIES || 2)));
const PROVIDER_TRANSIENT_BASE_MS = Math.max(250, Math.min(5000, Number(process.env.LAZYDEV_TRANSIENT_BASE_MS || 800)));
const PROVIDER_TRANSIENT_MAX_MS = Math.max(PROVIDER_TRANSIENT_BASE_MS, Math.min(30000, Number(process.env.LAZYDEV_TRANSIENT_MAX_MS || 8000)));
const TOKEN_CODEC_ENABLED = !['0','false','off','disabled'].includes(String(process.env.LAZYDEV_TOKEN_CODEC || 'auto').trim().toLowerCase());
const TOKEN_CODEC_PROTECT_LAST = Math.max(4, Math.min(12, Number(process.env.LAZYDEV_TOKEN_CODEC_PROTECT_LAST || FOVEANCE_DEFAULTS.protectLast)));
const TOKEN_CODEC_MIN_CHARS = Math.max(256, Math.min(20000, Number(process.env.LAZYDEV_TOKEN_CODEC_MIN_CHARS || FOVEANCE_DEFAULTS.minChars)));
const TOKEN_CODEC_TEMPLATE_MODE = (() => {
  const value = String(process.env.LAZYDEV_TOKEN_CODEC_TEMPLATE || 'auto').trim().toLowerCase();
  return ['on','true','1','auto','off','false','0','disabled'].includes(value) ? (value === 'true' || value === '1' ? 'on' : value === 'false' || value === '0' || value === 'disabled' ? 'off' : value) : 'auto';
})();
const TOKEN_CODEC_TEMPLATE_PRESSURE = Math.max(0.55, Math.min(0.95, Number(process.env.LAZYDEV_TOKEN_CODEC_TEMPLATE_PRESSURE || 0.78)));
const TOKEN_CODEC_TEMPLATE_MIN_SAVED = Math.max(64, Math.min(4096, Number(process.env.LAZYDEV_TOKEN_CODEC_TEMPLATE_MIN_SAVED || 128)));
const ANTIGRAVITY_AGENT = 'antigravity-preview-09-2026';
const KIMI_BUILTIN_TOOLS = [
  'Read','Write','Edit','Grep','Glob','ReadMediaFile','Bash',
  'WebSearch','FetchURL','EnterPlanMode','ExitPlanMode','TodoList',
  'Agent','AgentSwarm','AskUserQuestion','NotifyUser','Skill',
  'TaskList','TaskOutput','TaskStop','WaitFor'
];
// OpenAI-only request fields Kimi Code may send that not every OpenAI-compatible
// backend accepts (NVIDIA's endpoint validation rejects unknown fields with a
// 400 Validation error). Stripped by the local compatibility proxy before the
// request is forwarded upstream.
const UNSUPPORTED_PASSTHROUGH_FIELDS = ['prompt_cache_key', 'safety_identifier'];
const skills = [
  ['lazy-developer', 'Build and ship with focused engineering workflow'],
  ['lazy-debug', 'Diagnose bugs with evidence-first debugging'],
  ['lazy-review', 'Review code for correctness, risks, and regressions'],
  ['lazy-test', 'Verify behavior and coverage'],
];
const SOURCE_SKILL_NAMES = skills.map(([name]) => name);
const providers = [
  { id: 'openrouter', label: 'OpenRouter', kind: 'openai', modelsUrl: 'https://openrouter.ai/api/v1/models', chatUrl: 'https://openrouter.ai/api/v1/chat/completions', env: 'OPENROUTER_API_KEY' },
  { id: 'gemini', label: 'Gemini', kind: 'gemini', modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models', env: 'GEMINI_API_KEY' },
  { id: 'nvidia', label: 'NVIDIA', kind: 'openai', modelsUrl: 'https://integrate.api.nvidia.com/v1/models', chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions', env: 'NVIDIA_API_KEY' },
  { id: 'openai', label: 'OpenAI', kind: 'openai', modelsUrl: 'https://api.openai.com/v1/models', chatUrl: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY' },
  { id: 'ollama', label: 'Ollama Local', kind: 'ollama', env: null },
  { id: 'llm7', label: 'LLM7', kind: 'openai', modelsUrl: 'https://api.llm7.io/v1/models', chatUrl: 'https://api.llm7.io/v1/chat/completions', env: 'LLM7_API_KEY' },
  { id: 'groq', label: 'Groq', kind: 'openai', modelsUrl: 'https://api.groq.com/openai/v1/models', chatUrl: 'https://api.groq.com/openai/v1/chat/completions', env: 'GROQ_API_KEY' },
  { id: 'codebuddy', label: 'CodeBuddy', kind: 'codebuddy', modelsUrls: ['https://copilot.tencent.com/v3/config', 'https://api.codebuddy.ai/v1/models'], chatUrls: ['https://copilot.tencent.com/v2/chat/completions', 'https://api.codebuddy.ai/v1/chat/completions'], env: 'CODEBUDDY_API_KEY' },
  { id: 'anthropic', label: 'Anthropic', kind: 'anthropic', modelsUrl: 'https://api.anthropic.com/v1/models', chatUrl: 'https://api.anthropic.com/v1/messages', env: 'ANTHROPIC_API_KEY' },
];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EFFICIENCY_POLICY_FILE = path.join(root, 'runtime', 'lazy-efficiency.md');
const isWin = process.platform === 'win32';
const platform = platformPaths();
const isTermux = platform.termux;
const localRequire = createRequire(import.meta.url);
function efficiencyPolicy() {
  try { return fs.readFileSync(EFFICIENCY_POLICY_FILE, 'utf8').trim(); } catch { return ''; }
}
function efficiencyStatus() {
  const text = efficiencyPolicy();
  return { active: Boolean(text), target: text.includes('~75%') ? 0.75 : null, policyFile: EFFICIENCY_POLICY_FILE };
}


function parseUiArgs(argv) {
  const opts = {}; const queryParts = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    if (arg === '--json') { opts.json = true; continue; }
    if (arg === '--persist') { opts.persist = true; continue; }
    if (arg === '--page') { opts.page = String(argv[++i] || '').trim() || null; continue; }
    if (arg === '--project') { opts.projectName = String(argv[++i] || '').trim() || null; continue; }
    if (arg === '--stack') { opts.stack = String(argv[++i] || '').trim() || null; continue; }
    if (arg === '--motion' || arg === '--density' || arg === '--variance') {
      const value = Number(argv[++i]);
      if (Number.isFinite(value)) opts[arg.slice(2)] = value;
      continue;
    }
    if (arg === '--output-dir') { opts.outputDir = String(argv[++i] || '').trim() || null; continue; }
    queryParts.push(arg);
  }
  return { opts, query: queryParts.join(' ').trim() };
}
function languageCommand(argv) {
  const json = argv.includes('--json');
  const projectIndex = argv.indexOf('--project');
  const cwd = projectIndex >= 0 && argv[projectIndex + 1] ? path.resolve(argv[projectIndex + 1]) : process.cwd();
  const report = getLanguageReport(cwd);
  if (json) return console.log(JSON.stringify(report, null, 2));
  clearScreen();
  title('LazyDev language systems');
  line(`Workspace     ${cwd}`);
  line(`Primary       ${report.primary.id}${report.primary.id !== 'unknown' ? ` · ${(report.primary.confidence * 100).toFixed(0)}% confidence` : ''}`);
  line();
  if (!report.languages.length) {
    line(dim('No dedicated TypeScript or Go project detected.'));
    line();
    line(buildLanguageFrame({ cwd }));
    return;
  }
  for (const lang of report.languages) {
    line(`${ansi('36', '◆')} ${lang.id} · ${(lang.confidence * 100).toFixed(0)}%`);
    line(`  evidence: ${lang.evidence.slice(0, 8).join(', ')}`);
  }
  line();
  for (const contract of report.contracts) {
    line(`${ansi('36', contract.id)} checks:`);
    for (const [key, command] of Object.entries(contract.commands)) line(`  ${key}: ${command}`);
  }
  line();
  line(dim('The selected language contract is also injected into the active CLI agent session.'));
}

function uiCommand(argv) {
  const { opts, query } = parseUiArgs(argv);
  if (!query) throw new Error('Usage: lazydev ui "<product + interface brief>" [--json] [--persist] [--page <name>]');
  const result = generateDesignSystem(query, { ...opts, cwd: process.cwd() });
  if (opts.json) {
    console.log(JSON.stringify({
      query: result.query, project: result.project, stack: result.stack, decisionTrace: result.trace,
      designSystem: result.resolution, matches: result.matches, components: result.components, stackRules: result.stackRules, uxRules: result.uxRules, persistence: result.persistence
    }, null, 2));
  } else {
    console.log(result.markdown);
    if (result.persistence?.master) console.log(`\nPersisted: ${result.persistence.master}`);
    if (result.persistence?.page) console.log(`Page override: ${result.persistence.page}`);
  }
}

function outputDirectory() {
  const configured = String(process.env.LAZYDEV_ARTIFACT_DIR || '').trim();
  return configured || platform.artifactDirectory;
}
function ensureOutputDirectory() {
  const dir = outputDirectory();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function safeArtifactPath(name) {
  const raw = String(name || '').trim();
  if (!raw) throw new Error('Artifact filename is required.');
  if (path.isAbsolute(raw) || raw.includes('\\') || raw.includes('/') || raw === '.' || raw === '..') {
    throw new Error('Use a filename only; nested/absolute artifact paths are not allowed.');
  }
  const full = path.resolve(outputDirectory(), raw);
  if (path.dirname(full) !== path.resolve(outputDirectory())) throw new Error('Artifact path escaped the LazyDev artifact directory.');
  return full;
}
function runtimePolicyPath(name) { return path.join(root, 'runtime', name); }
function resolveKimiPackageRoot() {
  const roots = [];
  try {
    const entry = localRequire.resolve(KIMI_PACKAGE);
    let dir = fs.statSync(entry).isDirectory() ? entry : path.dirname(entry);
    while (true) {
      const pkg = path.join(dir, 'package.json');
      if (fs.existsSync(pkg)) {
        try { if (JSON.parse(fs.readFileSync(pkg, 'utf8'))?.name === KIMI_PACKAGE) roots.push(dir); } catch {}
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {}
  for (const candidate of [...new Set(roots)]) {
    try {
      const pkg = path.join(candidate, 'package.json');
      if (fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, 'utf8'))?.name === KIMI_PACKAGE) return candidate;
    } catch {}
  }
  return null;
}
function kimiPackageRequire() {
  const packageRoot = resolveKimiPackageRoot();
  if (!packageRoot) return null;
  try { return createRequire(path.join(packageRoot, 'package.json')); } catch { return null; }
}

function configDir() { return platform.configDirectory; }
function configFile() { return path.join(configDir(), 'config.json'); }
function kimiHome() { return platform.kimiHome; }
function readConfig() {
  try { const data = JSON.parse(fs.readFileSync(configFile(), 'utf8')); return data && typeof data === 'object' ? data : {}; } catch { return {}; }
}
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  try { fs.renameSync(tmp, file); } catch { try { fs.rmSync(file, { force: true }); } catch {} fs.renameSync(tmp, file); }
  if (!isWin) { try { fs.chmodSync(file, 0o600); } catch {} }
}
function writeTextAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, String(text), { mode: 0o600 });
  try { fs.renameSync(tmp, file); }
  catch { try { fs.rmSync(file, { force: true }); } catch {} fs.renameSync(tmp, file); }
  if (!isWin) { try { fs.chmodSync(file, 0o600); } catch {} }
}
function normalizeConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? { ...raw } : {};
  const p = cfg.providers && typeof cfg.providers === 'object' ? { ...cfg.providers } : {};
  if (!p.gemini && (typeof cfg.apiKey === 'string' || typeof cfg.model === 'string')) {
    p.gemini = { apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey.trim() : '', model: typeof cfg.model === 'string' && cfg.model.trim() ? cfg.model.trim() : 'gemini-flash-lite-latest' };
  }
  cfg.providers = p;
  if (!providers.some((x) => x.id === cfg.activeProvider)) cfg.activeProvider = 'gemini';
  delete cfg.apiKey; delete cfg.model;
  return migrateDisabledModelConfig(cfg);
}
function writeConfig(data) { writeJsonAtomic(configFile(), data); }
function providerConfig(cfg, id) { const x = cfg.providers?.[id]; return x && typeof x === 'object' ? x : {}; }
function migrateDisabledModelConfig(cfg) {
  const active = providers.find((x) => x.id === cfg.activeProvider);
  const activePc = active ? providerConfig(cfg, active.id) : {};
  if (active?.id !== 'gemini' || !isAntigravityModel(activePc.model)) return cfg;
  const fallback = providers.find((candidate) => {
    if (candidate.id === 'gemini') return false;
    const c = providerConfig(cfg, candidate.id);
    return Boolean(c.apiKey && c.model) || (candidate.id === 'ollama' && Boolean(c.baseUrl && c.model));
  });
  if (fallback) cfg.activeProvider = fallback.id;
  else activePc.model = '';
  return cfg;
}
function activeProvider(cfg) { return providers.find((x) => x.id === cfg.activeProvider) || providers.find((x) => x.id === 'gemini') || providers[0]; }
async function verifyLiveModel(provider, pc) {
  if (!pc?.apiKey || !pc?.model) return { status: 'not-configured' };
  try {
    const models = await fetchModels(provider, pc.apiKey);
    const found = models.find((m) => m.id === pc.model);
    if (!found) return { status: 'missing', models };
    if (provider.id === 'openrouter' && found.toolUse === false) return { status: 'no-tools', model: found, models };
    return { status: 'ok', model: found, models };
  } catch (error) {
    return { status: 'unverified', error: error instanceof Error ? error.message : String(error) };
  }
}

function truncate(s, n = 48) { const x = String(s || ''); return x.length <= n ? x : `${x.slice(0, Math.max(1, n - 1)).trimEnd()}…`; }

function ansi(code, text) { return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : String(text); }
function title(text) { console.log(`\n${ansi('1;36', text)}\n`); }
function line(text = '') { console.log(text); }
function green(text) { return ansi('32', text); }
function yellow(text) { return ansi('33', text); }
function red(text) { return ansi('31', text); }
function dim(text) { return ansi('2', text); }

class InputInterruptedError extends Error {
  constructor(source = 'input') {
    super('Input interrupted.');
    this.name = 'InputInterruptedError';
    this.code = 'LAZYDEV_INPUT_INTERRUPTED';
    this.source = source;
  }
}

async function prompt(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      crlfDelay: Infinity,
    });
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      try { rl.close(); } catch {}
      try { process.stdin.pause(); } catch {}
    };
    const onSigint = () => {
      cleanup();
      process.stdout.write('\n');
      reject(new InputInterruptedError('prompt'));
    };
    rl.once('SIGINT', onSigint);
    rl.question(question, (answer) => {
      rl.off('SIGINT', onSigint);
      cleanup();
      resolve(String(answer || ''));
    });
  });
}

async function requestJson(urlString, { method = 'GET', headers = {}, body, timeout = 12000 } = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(urlString).trim());
  } catch {
    throw new Error(`Invalid provider URL: ${String(urlString)}. Use a full http:// or https:// URL.`);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error(`Invalid provider URL: ${parsedUrl.href}. Use a full http:// or https:// URL.`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeout));
  try {
    const response = await fetch(urlString, {
      method,
      headers: { accept: 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) {
      throw new Error(`${response.status}: ${data?.error?.message || data?.message || text.slice(0, 500) || 'request failed'}`);
    }
    return data ?? {};
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Request timed out after ${Math.max(1000, timeout)}ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDER_OUTPUT_HARD_CAPS = Object.freeze({
  openrouter: 32768,
  gemini: 32768,
  nvidia: 32768,
  openai: 32768,
  ollama: 32768,
  llm7: 32768,
  groq: 32768,
  codebuddy: 32768,
  anthropic: 65536,
});
const KNOWN_MODEL_LIMITS = [
  { test: /^nvidia\/nemotron-3-super-120b-a12b$/i, contextLimit: 1048576, outputLimit: 32768, toolUse: true, thinking: false, offEffort: 'none', provider: 'nvidia' },
  { test: /^gemini-3\.1-flash-image(?:-.+)?$/i, contextLimit: 131072, outputLimit: 32768, toolUse: false, thinking: true },
  { test: /^gemini-3\.1-flash-lite(?:-.+)?$/i, contextLimit: 1048576, outputLimit: 65536, toolUse: true, thinking: true },
  { test: /^gemini-3\.1-pro(?:-.+)?$/i, contextLimit: 1048576, outputLimit: 65536, toolUse: true, thinking: true },
  { test: /^gemini-3-flash(?:-.+)?$/i, contextLimit: 1048576, outputLimit: 65536, toolUse: true, thinking: true },
];
function knownModelInfo(id, providerId = '') {
  const model = String(id || '').trim();
  const match = KNOWN_MODEL_LIMITS.find((rule) => rule.test.test(model) && (!rule.provider || rule.provider === providerId));
  return match ? { ...match } : {};
}
function applyKnownModelLimits(info, provider) {
  const out = { ...(info || {}) };
  const known = knownModelInfo(out.id || out.model || '', provider?.id || provider?.kind || '');
  if (!Number(out.contextLimit) && known.contextLimit) out.contextLimit = known.contextLimit;
  if (!Number(out.inputLimit) && known.contextLimit) out.inputLimit = known.contextLimit;
  if (!Number(out.outputLimit) && known.outputLimit) out.outputLimit = known.outputLimit;
  if (known.toolUse !== undefined && /image/i.test(String(out.id || '')) && provider?.id === 'gemini') out.toolUse = known.toolUse;
  if (known.offEffort) out.offEffort = known.offEffort;
  return out;
}
function isAntigravityModel(modelId) {
  return /^antigravity-preview(?:-|$)/i.test(String(modelId || '').trim());
}
function geminiModelSupportsKimiTools(modelId) {
  const id = String(modelId || '').trim();
  return isAntigravityModel(id) || !GEMINI_NO_TOOL_MODELS.some((pattern) => pattern.test(id));
}
function modelSupportsKimiTools(provider, pc) {
  if (provider?.id === 'gemini') return pc?.toolUse !== false && geminiModelSupportsKimiTools(pc?.model);
  return pc?.toolUse !== false;
}
function normalizeOllamaBaseUrl(value) {
  let url = String(value || '').trim();
  if (!url) url = 'http://127.0.0.1:11434';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;
  assertHttpUrl(url, 'Ollama API URL');
  url = url.replace(/\/+$/, '');
  for (const suffix of ['/api/tags', '/api/tag', '/v1/models', '/v1']) {
    if (url.toLowerCase().endsWith(suffix)) { url = url.slice(0, -suffix.length); break; }
  }
  url = url.replace(/\/$/, '');
  return url;
}
function ollamaModelsUrl(baseUrl) { return `${normalizeOllamaBaseUrl(baseUrl)}/api/tags`; }
function ollamaChatUrl(baseUrl) { return `${normalizeOllamaBaseUrl(baseUrl)}/v1/chat/completions`; }
function extractModelRecords(value, depth = 0) {
  if (depth > 5 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => extractModelRecords(item, depth + 1));
  if (typeof value !== 'object') return [];
  const direct = [];
  const id = value.id ?? value.model ?? value.name ?? value.slug;
  if (typeof id === 'string' && id.trim()) direct.push({ ...value, id: id.trim() });
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id' || key === 'model' || key === 'name' || key === 'slug') continue;
    if (Array.isArray(child) || (child && typeof child === 'object')) direct.push(...extractModelRecords(child, depth + 1));
  }
  return direct;
}
function normalizeModel(item, provider) {
  const id = String(provider.kind === 'gemini' ? item.name || '' : item.id || item.model || item.name || '').replace(/^models\//, '');
  const known = knownModelInfo(id, provider.id);
  if (provider.kind === 'gemini') {
    const supportedActions = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
    return applyKnownModelLimits({
      id,
      name: String(item.displayName || item.name || id),
      inputLimit: Number(item.inputTokenLimit) || known.contextLimit || null,
      outputLimit: Number(item.outputTokenLimit) || known.outputLimit || null,
      contextLimit: Number(item.inputTokenLimit) || known.contextLimit || null,
      live: true,
      supportedActions,
      toolUse: known.toolUse !== undefined ? known.toolUse : geminiModelSupportsKimiTools(id),
    }, provider);
  }
  if (provider.kind === 'ollama') {
    return applyKnownModelLimits({ id, name: id, inputLimit: null, outputLimit: null, contextLimit: null, live: true, toolUse: true, local: true }, provider);
  }
  if (provider.kind === 'codebuddy') {
    return applyKnownModelLimits({ id, name: String(item.displayName || item.name || item.id || id), inputLimit: Number(item.max_input_tokens) || Number(item.context_window) || null, outputLimit: Number(item.max_output_tokens) || Number(item.max_tokens) || null, contextLimit: Number(item.context_window) || Number(item.max_input_tokens) || null, live: true, toolUse: item.supportsToolCall !== false }, provider);
  }
  if (provider.kind === 'anthropic') {
    const capabilities = item.capabilities && typeof item.capabilities === 'object' ? item.capabilities : {};
    const toolUse = capabilities.tool_use?.supported === true || capabilities.tools?.supported === true;
    return applyKnownModelLimits({ id, name: String(item.display_name || item.name || id), inputLimit: Number(item.max_input_tokens) || known.inputLimit || null, outputLimit: Number(item.max_tokens) || known.outputLimit || null, contextLimit: Number(item.max_input_tokens) || known.contextLimit || null, live: true, capabilities, toolUse }, provider);
  }
  const supportedParameters = Array.isArray(item.supported_parameters) ? item.supported_parameters : null;
  const pricing = item.pricing && typeof item.pricing === 'object' ? item.pricing : {};
  const isFree = id === OPENROUTER_FREE_MODEL || /:free$/i.test(id) || (provider.id === 'openrouter' && String(pricing.prompt ?? '') === '0' && String(pricing.completion ?? '') === '0');
  const toolUse = supportedParameters ? supportedParameters.includes('tools') : null;
  return applyKnownModelLimits({ id, name: String(item.name || item.id || id), inputLimit: Number(item.context_length) || known.contextLimit || null, outputLimit: Number(item.top_provider?.max_completion_tokens) || Number(item.max_completion_tokens) || known.outputLimit || null, contextLimit: Number(item.context_length) || known.contextLimit || null, live: true, supportedParameters, toolUse, isFree, pricing }, provider);
}
function syntheticOpenRouterFreeModel() {
  return {
    id: OPENROUTER_FREE_MODEL,
    name: 'Free Models Router · openrouter/free',
    inputLimit: 200000,
    outputLimit: 8192,
    contextLimit: 200000,
    live: true,
    supportedParameters: ['tools', 'structured_outputs'],
    toolUse: true,
    isFree: true,
    isRouter: true,
    pricing: { prompt: '0', completion: '0' },
  };
}
function sortOpenRouterModels(models) {
  return models.slice().sort((a, b) => {
    if (a.id === OPENROUTER_FREE_MODEL) return -1;
    if (b.id === OPENROUTER_FREE_MODEL) return 1;
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return String(a.name).localeCompare(String(b.name));
  });
}
function buildOpenRouterFreeFallbacks(primaryModel, models) {
  const pool = models.filter((m) => m.isFree && m.toolUse !== false && m.id && m.id !== primaryModel && m.id !== OPENROUTER_FREE_MODEL);
  const unique = [];
  const seen = new Set([primaryModel, OPENROUTER_FREE_MODEL]);
  for (const model of pool) {
    if (!model.id || seen.has(model.id)) continue;
    seen.add(model.id);
    unique.push(model.id);
    if (unique.length >= OPENROUTER_MODEL_FALLBACK_LIMIT) break;
  }
  return unique;
}
async function fetchModels(provider, apiKey, options = {}) {
  const timeout = Number(options.timeout) || 12000;
  if (provider.kind === 'ollama') {
    const baseUrl = normalizeOllamaBaseUrl(options.baseUrl);
    try {
      const data = await requestJson(ollamaModelsUrl(baseUrl), { timeout });
      return (Array.isArray(data.models) ? data.models : []).map((item) => normalizeModel(item, provider)).filter((x) => x.id);
    } catch (primaryError) {
      const data = await requestJson(`${baseUrl}/v1/models`, { timeout });
      return (Array.isArray(data.data) ? data.data : []).map((item) => normalizeModel(item, provider)).filter((x) => x.id);
    }
  }
  if (provider.kind === 'gemini') {
    const data = await requestJson(`${provider.modelsUrl}?key=${encodeURIComponent(apiKey)}&pageSize=1000`, { timeout });
    const models = (Array.isArray(data.models) ? data.models : [])
      .filter((x) => Array.isArray(x.supportedGenerationMethods) && x.supportedGenerationMethods.includes('generateContent'))
      .map((x) => normalizeModel(x, provider)).filter((x) => x.id);
    return models.filter((m) => !isAntigravityModel(m.id));
  }
  if (provider.kind === 'anthropic') {
    const data = await requestJson(provider.modelsUrl, { timeout, headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'user-agent': `lazydev/${version}` } });
    return (Array.isArray(data.data) ? data.data : []).map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  }
  if (provider.kind === 'codebuddy') {
    const urls = Array.isArray(provider.modelsUrls) ? provider.modelsUrls : [];
    let lastError = null;
    for (const url of urls) {
      try {
        const headers = { Authorization: `Bearer ${apiKey}`, 'x-api-key': apiKey, 'user-agent': `lazydev/${version}` };
        const data = await requestJson(url, { timeout, headers });
        const raw = Array.isArray(data.data) ? data.data : extractModelRecords(data);
        const models = raw.map((x) => typeof x === 'string' ? ({ id: x }) : x).map((x) => normalizeModel(x, provider)).filter((x) => x.id);
        if (models.length) return Array.from(new Map(models.map((m) => [m.id, m])).values());
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('CodeBuddy did not return a live model catalog.');
  }
  const data = await requestJson(provider.modelsUrl, { timeout, headers: { Authorization: `Bearer ${apiKey}`, 'user-agent': `lazydev/${version}` } });
  const list = Array.isArray(data.data) ? data.data : [];
  if (provider.id !== 'openrouter') return list.map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  const filtered = list.filter((x) => !Array.isArray(x.supported_parameters) || x.supported_parameters.includes('tools'));
  const models = filtered.map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  if (!models.some((x) => x.id === OPENROUTER_FREE_MODEL)) models.unshift(syntheticOpenRouterFreeModel());
  return sortOpenRouterModels(models);
}

function clearScreen() {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
}
function findKimiInvocation() {
  // Prefer the native Kimi Code installation managed by this project.
  // This prevents an older npm/global shim from shadowing a freshly refreshed launcher.
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const nativeCandidates = isWin
    ? [path.join(home, '.kimi-code', 'bin', 'kimi.exe'), path.join(home, '.local', 'bin', 'kimi.exe'), path.join(home, '.local', 'bin', 'kimi.cmd')]
    : [path.join(home, '.kimi-code', 'bin', 'kimi'), path.join(home, '.local', 'bin', 'kimi')];
  for (const candidate of nativeCandidates) {
    try { if (fs.existsSync(candidate)) return { command: candidate, args: [] }; } catch {}
  }
  const pathCandidates = isWin ? ['kimi.cmd', 'kimi.exe'] : ['kimi'];
  const probe = isWin ? 'where' : 'which';
  for (const candidate of pathCandidates) {
    try {
      const out = spawnSync(probe, [candidate], { encoding: 'utf8' });
      if (out.status === 0) {
        const first = String(out.stdout || '').split(/\r?\n/).map((x) => x.trim()).find(Boolean);
        if (first) return { command: first, args: [] };
      }
    } catch {}
  }
  const packageRoot = resolveKimiPackageRoot();
  if (!packageRoot) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const binSpec = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.kimi;
    if (!binSpec) return null;
    const entry = path.resolve(packageRoot, binSpec);
    if (!fs.existsSync(entry)) return null;
    if (entry.endsWith('.mjs') || entry.endsWith('.js')) return { command: process.execPath, args: [entry] };
    return { command: entry, args: [] };
  } catch {
    return null;
  }
}
function findKimiCli() {
  return findKimiInvocation()?.command || null;
}

function kimiEntry() {
  const packageRoot = resolveKimiPackageRoot();
  return packageRoot ? path.join(packageRoot, 'package.json') : null;
}
function unsupportedRequestFieldsFromError(text) {
  const value = String(text || '');
  const names = new Set();
  for (const match of value.matchAll(/[`"]([A-Za-z_][A-Za-z0-9_]*)[`"]/g)) names.add(match[1]);
  if (!names.size && /unsupported parameter|unrecognized request argument|unknown parameter/i.test(value)) {
    const match = value.match(/(?:parameter(?:s)?|argument|field)\s*[:=]?\s*([A-Za-z_][A-Za-z0-9_]*)/i);
    if (match) names.add(match[1]);
  }
  return names;
}
function normalizeOpenAICompatibleRequest(body, provider, pc, removed = new Set()) {
  const out = { ...(body || {}) };
  for (const field of UNSUPPORTED_PASSTHROUGH_FIELDS) { out[field] = undefined; delete out[field]; removed.add(field); }
  const info = effectiveModelInfo(provider, pc);
  const hardCap = PROVIDER_OUTPUT_HARD_CAPS[provider.id] || 32768;
  const outputCap = Math.max(256, Math.min(Number(info.outputLimit) || hardCap, hardCap));
  for (const field of ['max_tokens', 'max_completion_tokens']) {
    if (out[field] !== undefined) {
      const n = Number(out[field]);
      if (Number.isFinite(n) && n > 0) out[field] = Math.max(1, Math.min(Math.floor(n), outputCap));
      else delete out[field];
    }
  }
  if (out.max_tokens === undefined && out.max_completion_tokens === undefined) out.max_tokens = outputCap;
  if (provider.id === 'nvidia') {
    out.reasoning_effort = undefined;
    delete out.reasoning_effort;
    delete out.reasoning;
    const extra = out.extra_body && typeof out.extra_body === 'object' ? { ...out.extra_body } : {};
    const kwargs = extra.chat_template_kwargs && typeof extra.chat_template_kwargs === 'object' ? { ...extra.chat_template_kwargs } : {};
    kwargs.enable_thinking = true;
    kwargs.low_effort = true;
    kwargs.force_nonempty_content = true;
    extra.chat_template_kwargs = kwargs;
    out.extra_body = extra;
  }
  return out;
}
async function createProxy(provider, pc, proxyOptions = {}) {
  const token = crypto.randomBytes(24).toString('hex');
  const server = http.createServer((req, res) => {
    const expected = `Bearer ${token}`;
    if (req.headers.authorization !== expected) {
      req.resume();
      res.writeHead(401, {'content-type':'application/json'});
      res.end(JSON.stringify({error:{message:'Unauthorized'}}));
      return;
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const expectedPath = provider.id === 'anthropic' ? '/v1/messages' : '/v1/chat/completions';
    if (req.method !== 'POST' || url.pathname !== expectedPath) {
      res.writeHead(404, {'content-type':'application/json'});
      res.end(JSON.stringify({error:{message:'Not found'}}));
      return;
    }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) req.destroy(new Error('Request too large'));
    });
    req.on('error', err => { try { res.destroy(err); } catch {} });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw || '{}'); }
      catch {
        res.writeHead(400, {'content-type':'application/json'});
        res.end(JSON.stringify({error:{message:'Invalid JSON'}}));
        return;
      }
      body.model = pc.model;
      if (Array.isArray(body.messages)) body.messages = repairOpenAIHistory(body.messages);
      const removedRequestFields = new Set(UNSUPPORTED_PASSTHROUGH_FIELDS);
      const preparedBody = provider.id === 'gemini' ? prepareGeminiRequest(body, pc.model) : normalizeOpenAICompatibleRequest(body, provider, pc, removedRequestFields);
      if (preparedBody !== body) body = preparedBody;
      if (provider.id === 'openrouter') {
        const providerOptions = body.provider && typeof body.provider === 'object' && !Array.isArray(body.provider) ? body.provider : {};
        body.provider = { ...providerOptions, require_parameters: true, allow_fallbacks: true };
        const freeFallbacks = Array.isArray(proxyOptions.freeFallbacks) ? proxyOptions.freeFallbacks : [];
        if (pc.model === OPENROUTER_FREE_MODEL || /:free$/i.test(pc.model)) {
          const fallbacks = Array.from(new Set(freeFallbacks)).filter((id) => id && id !== pc.model).slice(0, OPENROUTER_MODEL_FALLBACK_LIMIT);
          if (fallbacks.length) body.models = fallbacks;
          else delete body.models;
        }
      }
      let tokenCodecStats = { changed: false, savedTokens: 0, beforeChars: 0, afterChars: 0, references: 0, replacedLines: 0, eligiblePayloads: 0, templateSavedTokens: 0, templateReferences: 0, cacheBoundary: -1 };
      if (TOKEN_CODEC_ENABLED && Array.isArray(body.messages)) {
        const compressed = compressAgenticMessages(body.messages, {
          protectLast: TOKEN_CODEC_PROTECT_LAST,
          minChars: TOKEN_CODEC_MIN_CHARS,
          template: shouldUseTemplateCodec(body, pc),
        });
        tokenCodecStats = compressed;
        if (compressed.changed) body.messages = compressed.messages;
      }
      // The codec only rewrites old tool-result text; tool-call IDs, arguments, ordering, and
      // recent context remain untouched. A small response header exposes the local estimate.
      if (tokenCodecStats.savedTokens > 0) {
        res.setHeader('x-lazydev-token-codec', 'foveance-inspired');
        res.setHeader('x-lazydev-token-saved-estimate', String(tokenCodecStats.savedTokens));
        res.setHeader('x-lazydev-token-references', String(tokenCodecStats.references || 0));
      }

      // Kimi Code attaches OpenAI-only extras (e.g. prompt caching hints) to every
      // request regardless of backend. OpenRouter ignores fields it doesn't
      // recognize, but stricter OpenAI-compatible validators (e.g. NVIDIA's)
      // reject the request outright with 400 Validation errors. Strip anything
      // not part of the standard chat completions schema before forwarding.
      for (const field of UNSUPPORTED_PASSTHROUGH_FIELDS) delete body[field];
      const chatUrl = provider.id === 'ollama' ? ollamaChatUrl(pc.baseUrl) : provider.id === 'gemini' ? geminiOpenAIEndpoint(pc.model) : provider.id === 'anthropic' ? 'https://api.anthropic.com/v1/messages' : (provider.chatUrl || provider.chatUrls?.[0]);
      if (!chatUrl) {
        res.writeHead(500, {'content-type':'application/json'});
        res.end(JSON.stringify({error:{message:'Provider chat endpoint is not configured.'}}));
        return;
      }
      const target = new URL(chatUrl);
      const headers = {
        'content-type': 'application/json',
        'accept': req.headers.accept || 'application/json',
        ...(provider.id === 'ollama' ? {} : provider.id === 'anthropic' ? { 'x-api-key': pc.apiKey, 'anthropic-version': '2023-06-01' } : {'authorization': `Bearer ${pc.apiKey}`}),
        'user-agent': `lazydev/${version}`
      };
      const transport = target.protocol === 'http:' ? http : https;
      const sendUpstream = (requestBody, onResponse) => {
        const requestPayload = JSON.stringify(requestBody);
        const requestHeaders = { ...headers, 'content-length': Buffer.byteLength(requestPayload) };
        const upstream = transport.request({
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || (target.protocol === 'http:' ? 80 : 443),
          path: `${target.pathname}${target.search}`,
          method: 'POST',
          headers: requestHeaders
        }, onResponse);
        upstream.on('error', err => {
          if (!res.headersSent) {
            res.writeHead(502, {'content-type':'application/json'});
            res.end(JSON.stringify({error:{message:err.message}}));
          } else {
            try { res.destroy(err); } catch {}
          }
        });
        upstream.write(requestPayload);
        upstream.end();
        return upstream;
      };
      if (provider.id === 'gemini') {
        handleGeminiProxyRequest({ res, body, target, headers, pc, sendUpstream }).catch(error => {
          if (!res.headersSent) {
            res.writeHead(502, {'content-type':'application/json'});
            res.end(JSON.stringify({error:{message:error instanceof Error ? error.message : String(error)}}));
          } else { try { res.destroy(error); } catch {} }
        });
        return;
      }
      const transientFailure = async () => {
        let attempt = 0;
        let repairCount = 0;
        const removedFields = new Set(UNSUPPORTED_PASSTHROUGH_FIELDS);
        while (true) {
          const outboundBody = normalizeOpenAICompatibleRequest(body, provider, pc, removedFields);
          const result = await new Promise((resolve, reject) => {
            let responseSettled = false;
            const upstream = sendUpstream(outboundBody, upstreamRes => {
              const status = upstreamRes.statusCode || 502;
              if (status >= 400) {
                let errorBody = '';
                upstreamRes.setEncoding('utf8');
                upstreamRes.on('data', chunk => { errorBody += chunk; });
                upstreamRes.on('end', () => resolve({ ok: false, status, body: errorBody, headers: upstreamRes.headers }));
                upstreamRes.on('error', reject);
                return;
              }
              responseSettled = true;
              for (const [key, value] of Object.entries(upstreamRes.headers)) {
                if (value != null && !['content-length','connection','transfer-encoding'].includes(key.toLowerCase())) res.setHeader(key, value);
              }
              res.statusCode = status;
              upstreamRes.pipe(res);
              resolve({ ok: true, status });
            });
            upstream.on('error', reject);
            upstream.on('close', () => {
              if (!responseSettled && !res.headersSent) return;
            });
          }).catch(error => ({ ok: false, status: 502, body: error instanceof Error ? error.message : String(error), headers: {} }));

          if (result.ok) return;
          if (result.status === 400 && repairCount < 4) {
            const fields = [...unsupportedRequestFieldsFromError(result.body)].filter((field) => !removedFields.has(field));
            if (fields.length) {
              for (const field of fields) removedFields.add(field);
              repairCount += 1;
              for (const field of fields) delete body[field];
              continue;
            }
          }
          const retriable = shouldRetryTransient({ status: result.status, body: result.body, attempt, maxRetries: PROVIDER_TRANSIENT_MAX_RETRIES, committed: false });
          if (retriable) {
            const delay = transientRetryDelayMs(attempt, result.headers, { baseMs: PROVIDER_TRANSIENT_BASE_MS, maxMs: PROVIDER_TRANSIENT_MAX_MS, jitter: 0.20 });
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt += 1;
            continue;
          }
          if (!res.headersSent) {
            const parsed = (() => { try { return JSON.parse(result.body || '{}'); } catch { return null; } })();
            const detail = parsed?.error?.message || parsed?.message || result.body || '';
            const lower = String(result.body || '').toLowerCase();
            const openRouterFallbackStatus = provider.id === 'openrouter' && (res.statusCode === 404 || res.statusCode === 429);
            if (provider.id === 'openrouter' && lower.includes('no endpoints found') && lower.includes('tool use')) {
              res.statusCode = 503;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: { message: `OpenRouter has no live endpoint for ${pc.model} that satisfies Kimi Code tool use. Use openrouter/free or rerun lazydev setup.` } }));
              return;
            }
            if (openRouterFallbackStatus && result.status === 429) {
              const retryAfter = result.headers?.['retry-after'];
              const retryHint = retryAfter ? ` Retry-After: ${retryAfter}s.` : '';
              const fallbackHint = /:free$/i.test(pc.model) || pc.model === OPENROUTER_FREE_MODEL
                ? ' Free-model fallbacks were requested; all eligible endpoints may currently be rate-limited.'
                : ' OpenRouter provider failover was enabled for this model.';
              res.statusCode = 503;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: { message: `OpenRouter is rate-limited for ${pc.model}.${retryHint}${fallbackHint}` } }));
              return;
            }
            const overloaded = isTransientProviderFailure({ status: result.status, body: result.body });
            if (overloaded) {
              res.statusCode = 503;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: { message: buildTransientFailureMessage({ provider: provider.label, model: pc.model, status: result.status, attempts: attempt + 1, detail }) } }));
              return;
            }
            res.statusCode = result.status;
            res.setHeader('content-type', 'application/json');
            if (result.body.trim()) res.end(result.body);
            else res.end(JSON.stringify({ error: { message: `Provider ${provider.label} returned HTTP ${result.status} for model ${pc.model}.` } }));
          }
          return;
        }
      };
      transientFailure();

    });
  });
  await new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  if (!port) { try { server.close(); } catch {} throw new Error('LazyDev proxy failed to bind a loopback port.'); }
  return { server, token, port };
}


async function handleGeminiProxyRequest({ res, body, target, headers, pc, sendUpstream }) {
  const stream = body?.stream === true;
  let attempt = 0;
  let nextBody = buildGeminiRetryRequest(body, pc.model, attempt);
  while (true) {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const upstream = sendUpstream(nextBody, upstreamRes => {
        if ((upstreamRes.statusCode || 502) >= 400) {
          let errorBody = '';
          upstreamRes.setEncoding('utf8');
          upstreamRes.on('data', chunk => { errorBody += chunk; });
          upstreamRes.on('end', () => resolve({ type: 'http-error', status: upstreamRes.statusCode || 502, body: errorBody }));
          upstreamRes.on('error', reject);
          return;
        }
        if (!stream || !String(upstreamRes.headers['content-type'] || '').toLowerCase().includes('text/event-stream')) {
          let raw = '';
          upstreamRes.setEncoding('utf8');
          upstreamRes.on('data', chunk => { raw += chunk; });
          upstreamRes.on('end', () => {
            let json = null;
            try { json = JSON.parse(raw || '{}'); } catch {}
            resolve({ type: 'json', status: upstreamRes.statusCode || 200, headers: upstreamRes.headers, raw, json });
          });
          upstreamRes.on('error', reject);
          return;
        }

        let pending = '';
        let held = '';
        let visible = false;
        let finishReason = '';
        const forwardHeaders = () => {
          res.statusCode = upstreamRes.statusCode || 200;
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (value != null && !['content-length','connection','transfer-encoding'].includes(key.toLowerCase())) res.setHeader(key, value);
          }
        };
        const flushHeld = () => {
          if (!held) return;
          if (!res.headersSent) forwardHeaders();
          res.write(held);
          held = '';
        };
        const processBlock = block => {
          const parsed = parseSseEvent(block);
          if (parsed.json) {
            if (chunkHasVisibleOutput(parsed.json)) {
              visible = true;
              flushHeld();
            }
            const reason = chunkFinishReason(parsed.json);
            if (reason) finishReason = reason;
          }
          const serialized = `${block}\n\n`;
          if (visible) {
            if (!res.headersSent) forwardHeaders();
            res.write(serialized);
          } else {
            held += serialized;
          }
        };
        upstreamRes.on('data', chunk => {
          pending += String(chunk);
          const blocks = pending.split(/\r?\n\r?\n/);
          pending = blocks.pop() || '';
          for (const block of blocks) processBlock(block);
        });
        upstreamRes.on('end', () => {
          if (pending.trim()) processBlock(pending);
          const retry = streamNeedsGeminiRetry({ finishReason, visibleOutput: visible, retried: attempt > 0 });
          if (retry) {
            held = '';
            resolve({ type: 'retry', reason: finishReason });
            return;
          }
          if (!res.headersSent) forwardHeaders();
          flushHeld();
          if (!res.writableEnded) res.end();
          resolve({ type: 'streamed' });
        });
        upstreamRes.on('error', reject);
      });
      if (settled) return;
      upstream?.on?.('close', () => { settled = true; });
    });

    if (result.type === 'retry' && attempt < 2) {
      attempt += 1;
      nextBody = buildGeminiRetryRequest(body, pc.model, attempt);
      continue;
    }
    if (result.type === 'streamed') return;
    if (result.type === 'http-error') {
      const transient = isTransientProviderFailure({ status: result.status, body: result.body });
      if (transient && attempt < PROVIDER_TRANSIENT_MAX_RETRIES) {
        const delay = transientRetryDelayMs(attempt, result.headers, { baseMs: PROVIDER_TRANSIENT_BASE_MS, maxMs: PROVIDER_TRANSIENT_MAX_MS, jitter: 0.20 });
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt += 1;
        nextBody = buildGeminiRetryRequest(body, pc.model, attempt);
        continue;
      }
      if (result.status === 400 && attempt < 2) {
        attempt += 1;
        nextBody = buildGeminiRetryRequest(body, pc.model, attempt);
        continue;
      }
      res.statusCode = transient ? 503 : result.status;
      res.setHeader('content-type', 'application/json');
      if (transient) {
        const parsed = (() => { try { return JSON.parse(result.body || '{}'); } catch { return null; } })();
        const detail = parsed?.error?.message || parsed?.message || result.body || '';
        res.end(JSON.stringify({ error: { message: buildTransientFailureMessage({ provider: 'Gemini', model: pc.model, status: result.status, attempts: attempt + 1, detail }) } }));
      } else {
        res.end(result.body || JSON.stringify({error:{message:`Gemini returned HTTP ${result.status}.`}}));
      }
      return;
    }
    if (result.type === 'json') {
      if (responseHasUsableOutput(result.json) || attempt >= 2) {
        if (result.headers) for (const [key, value] of Object.entries(result.headers)) if (value != null && !['content-length','connection','transfer-encoding'].includes(key.toLowerCase())) res.setHeader(key, value);
        res.statusCode = result.status;
        res.end(result.raw || JSON.stringify(result.json || {}));
        return;
      }
      const reason = chunkFinishReason(result.json);
      if (/max_tokens|length|truncated/.test(reason) && attempt < 2) {
        attempt += 1;
        nextBody = buildGeminiRetryRequest(body, pc.model, attempt);
        continue;
      }
      res.statusCode = result.status;
      res.end(result.raw || JSON.stringify(result.json || {}));
      return;
    }
    return;
  }
}

function ensureKimiInstalled() {
  const packageRoot = resolveKimiPackageRoot();
  if (packageRoot) return true;
  const launcher = findKimiInvocation();
  if (launcher) return true;
  console.error(red(`Lazy Developer requires Kimi Code ${KIMI_VERSION}.`));
  console.error('Install it with the Lazy Developer installer, then run: lazydev chat');
  console.error('macOS/Linux: curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh');
  console.error('Windows PowerShell: irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1" -OutFile "$env:TEMP\lazydev-install.ps1"; & "$env:TEMP\lazydev-install.ps1"');
  return false;
}
function tomlQuote(text) { return JSON.stringify(String(text)); }
function assertHttpUrl(value, label = 'URL') {
  let parsed;
  try { parsed = new URL(String(value).trim()); } catch { throw new Error(`${label} is invalid. Expected an absolute http:// or https:// URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${label} is invalid. Expected an absolute http:// or https:// URL.`);
  }
  return parsed;
}
function estimateMessageTokens(messages) {
  try { return Math.max(1, Math.ceil(JSON.stringify(messages || []).length / 4)); } catch { return 0; }
}
function shouldUseTemplateCodec(body, pc) {
  if (TOKEN_CODEC_TEMPLATE_MODE === 'on') return true;
  if (TOKEN_CODEC_TEMPLATE_MODE !== 'auto') return false;
  const limit = Math.max(32768, Number(pc?.modelInfo?.contextLimit) || Number(pc?.modelInfo?.inputLimit) || 131072);
  return estimateMessageTokens(body?.messages) / limit >= TOKEN_CODEC_TEMPLATE_PRESSURE;
}

function activeProviderEnvKeys(provider) {
  if (provider.id === 'gemini') return ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GEMINI_BASE_URL', 'GEMINI_BASE_URL'];
  if (provider.id === 'anthropic') return ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL'];
  // All remaining LazyDev providers use Kimi's OpenAI-compatible adapter or
  // the local Ollama proxy, so stale OpenAI env overrides must not replace the
  // URL/key that LazyDev just generated for this session.
  return ['OPENAI_API_KEY', 'OPENAI_BASE_URL'];
}
function sanitizeKimiChildEnv(provider) {
  const env = { ...process.env };
  for (const key of activeProviderEnvKeys(provider)) delete env[key];
  // LazyDev owns KIMI_MODEL_* for the lifetime of the child process. Keeping a
  // stale shell override here could bypass the selected provider/proxy.
  for (const key of Object.keys(env)) {
    if (key.startsWith('KIMI_MODEL_')) delete env[key];
  }
  return env;
}
function buildKimiModelEnv(provider, pc, proxy, budget) {
  const env = {};
  // Kimi Code's KIMI_MODEL_* family is an in-memory model override with higher
  // priority than default_model. This keeps the LazyDev inference route stable
  // even when native /login or /logout reloads the on-disk configuration.
  env.KIMI_MODEL_NAME = String(pc.model);
  env.KIMI_MODEL_API_KEY = String(proxy?.token || pc.apiKey || '');
  env.KIMI_MODEL_MAX_CONTEXT_SIZE = String(Math.max(1024, budget.max));
  env.KIMI_MODEL_DISPLAY_NAME = `${provider.label} · ${pc.model}`;
  const capabilities = [];
  if (modelSupportsKimiTools(provider, pc)) capabilities.push('tool_use');
  if (provider.id === 'gemini' && !isAntigravityModel(pc.model)) capabilities.push('thinking');
  if (capabilities.length) env.KIMI_MODEL_CAPABILITIES = capabilities.join(',');
  if (budget.output) {
    env.KIMI_MODEL_MAX_COMPLETION_TOKENS = String(Math.max(256, budget.output));
    env.KIMI_MODEL_MAX_TOKENS = String(Math.max(256, budget.output));
  }
  if (provider.id === 'gemini' && !isAntigravityModel(pc.model)) env.KIMI_MODEL_THINKING_EFFORT = 'low';

  if (proxy) {
    env.KIMI_MODEL_PROVIDER_TYPE = provider.id === 'anthropic' && !isAntigravityModel(pc.model) ? 'anthropic' : 'openai';
    env.KIMI_MODEL_BASE_URL = `http://127.0.0.1:${proxy.port}/v1`;
  } else if (provider.id === 'gemini') {
    env.KIMI_MODEL_PROVIDER_TYPE = 'google-genai';
    env.KIMI_MODEL_BASE_URL = 'https://generativelanguage.googleapis.com';
  } else if (provider.id === 'anthropic') {
    env.KIMI_MODEL_PROVIDER_TYPE = 'anthropic';
    env.KIMI_MODEL_BASE_URL = 'https://api.anthropic.com';
  } else {
    env.KIMI_MODEL_PROVIDER_TYPE = 'openai';
    env.KIMI_MODEL_BASE_URL = 'https://api.openai.com/v1';
  }
  return env;
}

function extractExternalKimiSections(text) {
  const lines = String(text || '').split(/\r?\n/);
  const sections = [];
  let currentName = null;
  let buffer = [];
  const flush = () => {
    if (!currentName || !buffer.length) return;
    const normalized = currentName.replace(/^\[+|\]+$/g, '').trim();
    const isConfigNamespace = /^(providers|models|services)\./.test(normalized);
    const isLazyDevNamespace = normalized.includes('providers.lazydev') || normalized.includes('models.\"lazydev/') || normalized.includes('models.lazydev/');
    if (isConfigNamespace && !isLazyDevNamespace) sections.push(buffer.join('\n').trim());
    buffer = [];
  };
  for (const line of lines) {
    const header = line.match(/^\s*(\[\[?)([^\]]+?)(\]\]?)\s*$/);
    if (header) {
      flush();
      currentName = header[2].trim();
      buffer = [line];
      continue;
    }
    if (buffer.length) buffer.push(line);
  }
  flush();
  return sections.filter(Boolean);
}

function composeLazyDevConfig(provider, pc, proxy, sessionAliases, currentText = '') {
  const canonical = buildKimiConfig(provider, pc, proxy, sessionAliases).trimEnd();
  const preserved = extractExternalKimiSections(currentText);
  return preserved.length ? `${canonical}\n\n${preserved.join('\n\n')}\n` : `${canonical}\n`;
}

function startKimiAuthBridge({ configPath, provider, pc, proxy, sessionAliases }) {
  let repairTimer = null;
  let stopped = false;
  const repair = () => {
    if (stopped) return;
    try {
      const current = fs.readFileSync(configPath, 'utf8');
      const next = composeLazyDevConfig(provider, pc, proxy, sessionAliases, current);
      if (current !== next) writeTextAtomic(configPath, next);
    } catch {}
  };
  const schedule = () => {
    if (stopped) return;
    if (repairTimer) clearTimeout(repairTimer);
    repairTimer = setTimeout(repair, 80);
    repairTimer.unref?.();
  };
  let previousMtime = 0;
  const poll = setInterval(() => {
    if (stopped) return;
    try {
      const mtime = fs.statSync(configPath).mtimeMs;
      if (mtime !== previousMtime) {
        previousMtime = mtime;
        schedule();
      }
    } catch {}
  }, 50);
  poll.unref?.();
  return () => {
    stopped = true;
    clearInterval(poll);
    if (repairTimer) clearTimeout(repairTimer);
  };
}
function hasKimiSessions() {
  const index = path.join(kimiHome(), 'session_index.jsonl');
  const sessions = path.join(kimiHome(), 'sessions');
  try {
    if (fs.existsSync(index) && fs.statSync(index).size > 0) return true;
    if (fs.existsSync(sessions)) {
      const stack = [sessions];
      while (stack.length) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
          else if (entry.isFile() && entry.name === 'state.json') return true;
        }
      }
    }
  } catch {}
  return false;
}

function readTextSlice(file, maxBytes = 262144) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return '';
    if (stat.size <= maxBytes) return fs.readFileSync(file, 'utf8');
    const fd = fs.openSync(file, 'r');
    try {
      const headSize = Math.floor(maxBytes / 2);
      const tailSize = maxBytes - headSize;
      const head = Buffer.alloc(headSize);
      const tail = Buffer.alloc(tailSize);
      fs.readSync(fd, head, 0, headSize, 0);
      fs.readSync(fd, tail, 0, tailSize, Math.max(0, stat.size - tailSize));
      return `${head.toString('utf8')}
${tail.toString('utf8')}`;
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

function discoverSessionModelAliases(currentAlias = '') {
  const rootDir = path.join(kimiHome(), 'sessions');
  const sources = [path.join(kimiHome(), 'session_index.jsonl')];
  try {
    if (fs.existsSync(rootDir)) {
      const stack = [rootDir];
      let inspected = 0;
      while (stack.length && inspected < 5000) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, entry.name);
          if (entry.isDirectory()) stack.push(file);
          else if (entry.name === 'state.json' || entry.name === 'wire.jsonl' || entry.name === 'context.jsonl') sources.push(file);
          inspected += 1;
          if (inspected >= 5000) break;
        }
      }
    }
  } catch {}
  const texts = [];
  for (const file of sources.slice(0, 1500)) {
    const text = readTextSlice(file, file.endsWith('wire.jsonl') || file.endsWith('context.jsonl') ? 196608 : 131072);
    if (text) texts.push(text);
  }
  return extractSessionModelAliases(texts, currentAlias);
}

function writeLazyDevMcpConfig() {
  const file = path.join(kimiHome(), 'mcp.json');
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object') data = {};
  } catch {}
  const servers = data.mcpServers && typeof data.mcpServers === 'object' ? { ...data.mcpServers } : {};
  servers['lazydev-search'] = {
    command: process.execPath,
    args: [path.join(root, 'runtime', 'lazydev-web-search.mjs')],
    env: { LAZYDEV_SEARCH_USER_AGENT: `lazydev/${version}` },
    cwd: root,
  };
  data.mcpServers = servers;
  writeJsonAtomic(file, data);
  return file;
}
function mergeManagedMarkdown(file, startMarker, endMarker, block) {
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch {}
  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, 'g');
  const cleaned = existing.replace(pattern, '').replace(/[ \\t]+$/gm, '').trimEnd();
  const next = cleaned ? `${cleaned}\\n\\n${block.trim()}\\n` : `${block.trim()}\\n`;
  fs.writeFileSync(file, next, { mode: 0o600 });
}

function writeKimiAgentGuidance() {
  const dir = kimiHome();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const agents = path.join(dir, 'AGENTS.md');
  const block = `<!-- lazydev-runtime:start -->\n# LazyDev Runtime\n\n- Keep simple requests simple; no unnecessary architecture, files, abstractions, or prose.\n- When requirements/evidence are unclear, ask one focused question or state uncertainty; never invent assumptions.\n- Do not make unrelated or random changes; preserve working behavior and relevant scope only.\n- Always double-check the smallest meaningful result before saying the task is complete.\n- For the first user turn of a new session, respond in English unless another language is explicitly requested.\n- Repository source stays in the active workspace.\n- Standalone deliverables use ${outputDirectory()} only.\n- Use descriptive filenames, not index.* by default; never overwrite a standalone artifact—if the target exists, retry with the lowest free numeric suffix before the extension.\n- Never report a file as saved until the exact final path is verified.\n- Use the relevant LazyDev Skill when it materially applies; keep its use compact.\n- Prefer RTK for supported shell commands to reduce terminal-output tokens; use the raw command when RTK has no equivalent.\n<!-- lazydev-runtime:end -->`;
  mergeManagedMarkdown(agents, '<!-- lazydev-runtime:start -->', '<!-- lazydev-runtime:end -->', block);

  const system = path.join(dir, 'SYSTEM.md');
  const source = runtimePolicyPath('SYSTEM.md');
  const bodyText = fs.readFileSync(source, 'utf8').trimEnd();
  const aliasSystem = buildIntelligenceAliasSystem();
  const uiSystem = buildUiSystemPrompt();
  const nativeSystems = buildNativeSystemsPrompt();
  const languageSystem = buildLanguageFrame({ cwd: process.cwd() });
  fs.writeFileSync(system, `${bodyText}\n\n${nativeSystems}\n\n${uiSystem}\n\n${languageSystem}\n\n${aliasSystem}\n`, { mode: 0o600 });
}
function basePromptPlaceholder() { return '${base_prompt}'; }
function shellQuoteCommand(executable, args = []) {
  const quote = (value) => {
    const text = String(value);
    if (!/[\s"'`$&|;<>(){}\[\]]/.test(text)) return text;
    if (process.platform === 'win32') return `"${text.replaceAll('"', '\\"')}"`;
    return `'${text.replaceAll("'", "'\\''")}'`;
  };
  return [executable, ...args].map(quote).join(' ');
}
function effectiveModelInfo(provider, pc) {
  const info = applyKnownModelLimits({ id: pc?.model, ...(pc?.modelInfo || {}) }, provider);
  return info;
}

function contextBudget(modelInfo = {}) {
  const rawMax = Math.max(1024, Number(modelInfo?.contextLimit) || Number(modelInfo?.inputLimit) || 262144);
  const cap = Number(process.env.LAZYDEV_CONTEXT_CAP || 0);
  const max = cap > 0 ? Math.max(1024, Math.min(rawMax, cap)) : rawMax;
  const rawOutput = Math.max(256, Number(modelInfo?.outputLimit) || 16384);
  const output = Math.min(rawOutput, 32768);
  const reserveTarget = Math.max(4096, Math.min(49152, Math.max(output * 2, Math.round(max * 0.08))));
  const reserve = max > 4096 ? Math.min(reserveTarget, Math.max(1024, Math.floor(max / 4))) : Math.max(512, Math.floor(max / 8));
  const input = max;
  const ratio = max >= 262144 ? 0.90 : 0.88;
  return { max, output, reserve, input, ratio };
}

function buildKimiConfig(provider, pc, proxy = null, sessionAliases = []) {
  const alias = `lazydev/${pc.model}`;
  const budget = contextBudget(pc.modelInfo);
  const context = budget.max;
  const output = budget.output;
  const antigravity = provider.id === 'gemini' && isAntigravityModel(pc.model) && proxy;
  const geminiProxy = provider.id === 'gemini' && Boolean(proxy);
  const providerType = provider.id === 'gemini' && !antigravity && !geminiProxy ? 'google-genai' : antigravity || geminiProxy ? 'openai' : provider.id === 'anthropic' ? 'anthropic' : 'openai';
  const intelligence = modelIntelligenceProfile(pc.model);
  const toolUse = modelSupportsKimiTools(provider, pc);
  const modelCapabilities = toolUse ? (provider.id === 'gemini' ? ['tool_use','thinking'] : ['tool_use']) : [];
  const disabledToolsLines = toolUse ? [] : [
    '',
    '[tools]',
    `disabled = ${JSON.stringify(KIMI_BUILTIN_TOOLS)}`,
  ];
  const providerLines = proxy
    ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote(`http://127.0.0.1:${proxy.port}/v1`)}`,`api_key = ${tomlQuote(proxy.token)}`]
    : provider.id === 'gemini'
      ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote('https://generativelanguage.googleapis.com')}`,`api_key = ${tomlQuote(pc.apiKey)}`]
      : provider.id === 'anthropic'
        ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote('https://api.anthropic.com')}`,`api_key = ${tomlQuote(pc.apiKey)}`]
        : [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote('https://api.openai.com/v1')}`,`api_key = ${tomlQuote(pc.apiKey)}`];
  const artifactHook = path.join(root, 'hooks', 'lazydev-path-guard.mjs');
  const promptHook = path.join(root, 'hooks', 'lazydev-prompt-context.mjs');
  const shellHook = path.join(root, 'hooks', 'lazydev-shell-guard.mjs');
  const promptCommand = shellQuoteCommand(process.execPath, [promptHook]);
  const artifactCommand = shellQuoteCommand(process.execPath, [artifactHook]);
  const shellCommand = shellQuoteCommand(process.execPath, [shellHook]);
  const tokenConfig = buildKimiTokenConfig({ maxContext: context, maxOutput: output, reserveRatio: 0.08 });
  return [
    `default_model = ${tomlQuote(alias)}`,
    `default_permission_mode = ${tomlQuote('manual')}`,
    `default_plan_mode = false`,
    `merge_all_available_skills = true`,
    `builtin_product_skills = false`,
    `telemetry = false`,
    `show_thinking_stream = false`,
    ``,
    `database.base = true`,
    `database.search = true`,
    `extra_skill_dirs = [${tomlQuote(path.join(root, 'skills'))}]`,
    `extra_agent_dirs = [${tomlQuote(path.join(root, 'agents'))}]`,
    ...disabledToolsLines,
    ``,
    ...providerLines,
    ``,
    `[models.${JSON.stringify(alias)}]`,
    `provider = ${tomlQuote('lazydev')}`,
    `model = ${tomlQuote(pc.model)}`,
    `max_context_size = ${Math.max(1024, context)}`,
    `max_input_size = ${Math.max(1024, budget.input)}`,
    `max_output_size = ${Math.max(256, output)}`, 
    `capabilities = ${JSON.stringify(modelCapabilities)}`,
    `display_name = ${tomlQuote(`${provider.label} · ${pc.model}`)}`,
    ``,
    ...sessionAliases
      .filter((alias) => alias && alias !== `lazydev/${pc.model}`)
      .flatMap((alias) => [
        `[models.${JSON.stringify(alias)}]`,
        `provider = ${tomlQuote('lazydev')}`,
        `model = ${tomlQuote(pc.model)}`,
        `max_context_size = ${Math.max(1024, context)}`,
        `max_input_size = ${Math.max(1024, budget.input)}`,
        `max_output_size = ${Math.max(256, output)}`,
        `capabilities = ${JSON.stringify(modelCapabilities)}`,
        `display_name = ${tomlQuote(`Session compatibility · ${provider.label} · ${pc.model}`)}`,
        ``,
      ]),
    `[thinking]`,
    `enabled = ${provider.id === 'gemini' && !antigravity ? 'true' : 'false'}`,
    ...(provider.id === 'gemini' && !antigravity ? [`effort = ${tomlQuote('low')}`] : []),
    ``,
    `[loop_control]`,
    `max_attempts_per_step = 10`,
    `max_steps_per_turn = 0`,
    `reserved_context_size = ${budget.reserve}`,
    `compaction_trigger_ratio = ${budget.ratio.toFixed(2)}`,
    `compaction_max_attempts = 2`,
    ``,
    ...tokenConfig,
    `[mcp.client]`,
    `tool_call_timeout_ms = 60000`,
    ``,
    `[background]`,
    `keep_alive_on_exit = false`,
    ``,
    `[[hooks]]`,
    `event = ${tomlQuote('TurnStarted')}`,
    `command = ${tomlQuote(promptCommand)}`,
    `timeout = 3`,
    ``,
    `[[hooks]]`,
    `event = ${tomlQuote('UserPromptSubmit')}`,
    `command = ${tomlQuote(promptCommand)}`,
    `timeout = 3`,
    ``,
    `[[hooks]]`,
    `event = ${tomlQuote('PreToolUse')}`,
    `matcher = ${tomlQuote('Write|WriteFile|StrReplaceFile')}`,
    `command = ${tomlQuote(artifactCommand)}`,
    `timeout = 3`,
    ``,
    `[[hooks]]`,
    `event = ${tomlQuote('PreToolUse')}`,
    `matcher = ${tomlQuote('Shell')}`,
    `command = ${tomlQuote(shellCommand)}`,
    `timeout = 3`,
  ].join('\n') + '\n';
}

function buildTuiConfig() {
  return [
    `theme = "dark"`,
    `render_latex = true`,
    `disable_paste_burst = false`,
    `cache_expiry_hint = false`,
    `disable_feedback_survey = true`,
    ``,
    `[upgrade]`,
    `auto_install = false`,
    ``,
    `[notifications]`,
    `enabled = true`,
    `notification_condition = "unfocused"`,
    ``,
    `[status_line]`,
    `items = ["mode", "model", "tasks", "cwd", "git", "tips"]`,
  ].join('\n') + '\n';
}

async function setup() {
  const cfg = normalizeConfig(readConfig());
  clearScreen();
  title(`Lazy Developer ${version}`);
  line(dim('Provider setup · live model catalog'));
  line();
  providers.forEach((p, i) => {
    const c = providerConfig(cfg, p.id);
    const configured = p.id === 'ollama' ? Boolean(c.baseUrl && c.model) : Boolean(c.apiKey && c.model);
    const state = configured ? green('saved') : dim('not configured');
    line(`${i + 1}. ${p.label} · ${state}${c.model ? ` · ${truncate(c.model, 42)}` : ''}`);
  });
  line();
  const n = Number((await prompt(`Provider [1-${providers.length}]: `)).trim());
  if (!Number.isInteger(n) || n < 1 || n > providers.length) { line(red(`Choose a provider number from 1 to ${providers.length}.`)); return; }
  const provider = providers[n - 1];
  const saved = providerConfig(cfg, provider.id);
  let apiKey = String(saved.apiKey || '').trim();
  let baseUrl = String(saved.baseUrl || '').trim();
  if (provider.id === 'ollama') {
    baseUrl = (await prompt(`Ollama API URL [${baseUrl || 'http://127.0.0.1:11434'}]: `)).trim() || baseUrl || 'http://127.0.0.1:11434';
    baseUrl = normalizeOllamaBaseUrl(baseUrl);
    process.stdout.write(`${provider.label} · checking local API + live models ... `);
  } else {
    if (apiKey) {
      const keep = (await prompt(`${provider.label} key saved. Keep it? [Y/n]: `)).trim().toLowerCase();
      if (keep && !['y', 'yes'].includes(keep)) apiKey = '';
    }
    if (!apiKey) apiKey = (await prompt(`${provider.label} API key: `)).trim();
    if (!apiKey) { line(yellow('Skipped: no API key entered.')); return; }
    process.stdout.write(`${provider.label} · loading live models (15s timeout) ... `);
  }
  try {
    const models = await fetchModels(provider, apiKey, { baseUrl, timeout: 15000 });
    process.stdout.write(green(`${models.length} found\n`));
    if (!models.length) throw new Error('No compatible models returned.');
    if (provider.id === 'openrouter') {
      const freeCount = models.filter((m) => m.isFree).length;
      line(dim(`OpenRouter · ${freeCount} free/tool-capable entries · ${OPENROUTER_FREE_MODEL} included`));
    }
    const current = String(saved.model || '');
    let index = Math.max(0, models.findIndex((m) => m.id === current));
    const chosen = await selectModel(models, index);
    cfg.providers[provider.id] = provider.id === 'ollama'
      ? { baseUrl, apiKey: 'ollama', model: chosen.id, modelInfo: chosen }
      : { apiKey, model: chosen.id, modelInfo: chosen };
    cfg.activeProvider = provider.id;
    writeConfig(cfg);
    line(green(`✓ ${provider.label} · saved`));
    line(green(`✓ ${chosen.id} · saved`));
    if (chosen.toolUse === false) {
      line(yellow('• Compatibility mode: Kimi local tools are disabled for this model because its API does not accept Kimi function calls.'));
    }
    line();
  } catch (error) {
    if (error?.code === 'LAZYDEV_INPUT_INTERRUPTED') return;
    line(red(error instanceof Error ? error.message : String(error)));
  }
}
async function selectModel(models, initial = 0) {
  let index = Math.max(0, initial);
  if (!process.stdin.isTTY || !process.stdout.isTTY) return models[index];
  readlineInputKeys();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  clearScreen();
  let done = false;
  const render = () => {
    clearScreen();
    title('Choose a live model');
    const width = Number(process.stdout.columns) || 80;
    const start = Math.max(0, Math.min(index - 4, models.length - 9));
    const end = Math.min(models.length, start + (width < 80 ? 7 : 9));
    for (let i = start; i < end; i++) {
      const model = models[i];
      const label = model.id === OPENROUTER_FREE_MODEL ? `${model.name} ✓` : model.isFree ? `${model.name} · free` : model.name;
      line(`${i === index ? ansi('34', '›') : ' '} ${i === index ? ansi('34', label) : label}`);
    }
    line(); line(dim('↑/↓ select · Enter confirm'));
  };
  render();
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.off('keypress', onKey);
      try { process.stdin.setRawMode(false); } catch {}
      try { process.stdin.pause(); } catch {}
    };
    const onKey = (_str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\n');
        reject(new InputInterruptedError('model-selection'));
        return;
      }
      if (key.name === 'up') { index = (index - 1 + models.length) % models.length; render(); }
      else if (key.name === 'down') { index = (index + 1) % models.length; render(); }
      else if (key.name === 'return' || key.name === 'enter') {
        done = true;
        cleanup();
        process.stdout.write('\n');
        resolve();
      }
    };
    process.stdin.on('keypress', onKey);
  });
  return models[index];
}
function readlineInputKeys() { try { readline.emitKeypressEvents(process.stdin); } catch {} }

async function envInfo(jsonMode=false) {
  const data={
    version,
    platform:process.platform,
    arch:os.arch(),
    node:process.version,
    termux:isTermux,
    workspace:process.cwd(),
    artifactDirectory:outputDirectory(),
    configDirectory:configDir(),
    kimiHome:kimiHome(),
    skillsRoot:path.join(root,'skills'),
    packageRoot:root,
    artifactPolicy:'standalone deliverables only',
    tokenSavingsFloor:TOKEN_SAVINGS_FLOOR,
    tokenSavingsTarget:TOKEN_SAVINGS_TARGET,
    maxSkillFraction:MAX_SKILL_FRACTION,
    contextBudget:contextBudget(readConfig()?.providers?.[activeProvider(readConfig()).id]?.modelInfo || {}),
    intelligenceProfile:modelIntelligenceProfile(readConfig()?.providers?.[activeProvider(readConfig()).id]?.model || ''),
    responseEconomy:efficiencyStatus(),
  };
  if (jsonMode) return console.log(JSON.stringify(data,null,2));
  clearScreen(); title(`LazyDev ${version}`); line(`${ansi('36','◆')} Runtime`); line(`  ${data.platform} · ${data.arch} · ${data.node}`); line(`${ansi('36','◆')} Workspace`); line(`  ${data.workspace}`); line(`${ansi('36','◆')} Artifacts`); line(`  ${data.artifactDirectory}`); line(`${ansi('36','◆')} Config`); line(`  ${data.configDirectory}`); line(`${ansi('36','◆')} Kimi home`); line(`  ${data.kimiHome}`); line(`${ansi('36','◆')} Skills`); line(`  ${data.skillsRoot}`); line(`${ansi('36','◆')} Token target`); line(`  >= ${Math.round(data.tokenSavingsFloor*100)}% skill hot-path reduction · target ${Math.round(data.tokenSavingsTarget*100)}%`);
  line(`${ansi('36','◆')} Context`); line(`  up to ${data.contextBudget.max} tokens · reserve ${data.contextBudget.reserve} · compact at ${Math.round(data.contextBudget.ratio*100)}%`);
}
async function artifactCommand(name) {
  try { const full=safeArtifactPath(name); ensureOutputDirectory(); line(full); } catch(e){ line(red(e instanceof Error?e.message:String(e))); process.exitCode=1; }
}
function readTokenStats() {
  try {
    const evalFile = path.join(root, 'tests', 'skill-evals.json');
    const policyFile = path.join(root, 'runtime', 'token-policy.json');
    const ev = JSON.parse(fs.readFileSync(evalFile, 'utf8'));
    const pol = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
    const baseline = Number(ev.baseline_approx_tokens || 0);
    const current = [...SOURCE_SKILL_NAMES].reduce((n, name) => {
      try { return n + Math.floor(fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8').length / 4); }
      catch { return n; }
    }, 0);
    const reduction = baseline ? Math.max(0, 1 - current / baseline) : 0;
    return { baseline, current, reduction, target: Number(pol.target_hot_path_reduction || 0) };
  } catch {
    return { baseline: 0, current: 0, reduction: 0, target: 0.75 };
  }
}

function detectRtkVersion() {
  const candidates = isWin ? ['rtk.exe', 'rtk.cmd'] : ['rtk'];
  for (const candidate of candidates) {
    try {
      const out = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
      const match = String(out.stdout || out.stderr || '').match(/\d+\.\d+\.\d+/);
      if (out.status === 0 && match) return match[0];
    } catch {}
  }
  for (const candidate of [
    path.join(os.homedir(), '.local', 'bin', isWin ? 'rtk.exe' : 'rtk'),
    path.join(os.homedir(), '.cargo', 'bin', isWin ? 'rtk.exe' : 'rtk'),
  ]) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const out = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
      const match = String(out.stdout || out.stderr || '').match(/\d+\.\d+\.\d+/);
      if (out.status === 0 && match) return match[0];
    } catch {}
  }
  return '';
}

function doctor() {
  const cfg = normalizeConfig(readConfig());
  clearScreen();
  title(`Lazy Developer doctor · ${version}`);
  line(`Runtime       ${process.platform} · ${os.arch()} · Node ${process.version}`);
  line(`Agent CLI     ${findAvailableAgentCli()?.command || 'not detected'}`);
  line(`Skills        ${skills.length} bundled`);
  line(`RTK           ${detectRtkVersion() || 'not installed'}`);
  const token = readTokenStats();
  line(`Token gate    ${token.current}/${token.baseline} skill tokens · ${(token.reduction * 100).toFixed(1)}% reduction · floor ${(TOKEN_SAVINGS_FLOOR * 100).toFixed(0)}%+`);
  const active = activeProvider(cfg);
  const modelName = String(providerConfig(cfg, active.id).model || '');
  const intelligence = modelIntelligenceProfile(modelName);
  line(`Intelligence  ${intelligence.label} · ${intelligence.strategy} · effort ${intelligence.effort}`);
  const lang = getLanguageReport(process.cwd());
  line(`Languages     ${lang.languages.length ? lang.languages.map((x) => `${x.id} ${(x.confidence * 100).toFixed(0)}%`).join(' · ') : 'generic'}`);
  const cb = contextBudget(providerConfig(cfg, activeProvider(cfg).id).modelInfo || {});
  line(`Context       ${cb.max} max · ${cb.input} input · ${cb.reserve} reserve · compact ${Math.round(cb.ratio * 100)}%`);
  line(`Artifacts     ${outputDirectory()}`);
  let artifactWritable=false;
  try { ensureOutputDirectory(); fs.accessSync(outputDirectory(), fs.constants.W_OK); artifactWritable=true; } catch {}
  line(`Artifact I/O  ${artifactWritable ? green('ready') : red('not writable')}`);
  line();
  const checks = [
    ['package.json', fs.existsSync(path.join(root, 'package.json')), true],
    [KIMI_PACKAGE, Boolean(kimiEntry()), false],
    ['Managed CLI adapter', Boolean(findKimiCli()), false],
    ['Response economy policy', fs.existsSync(EFFICIENCY_POLICY_FILE), true],
    ...skills.map(([name]) => [`skills/${name}/SKILL.md`, fs.existsSync(path.join(root, 'skills', name, 'SKILL.md')), true]),
  ];
  checks.forEach(([name, ok, required]) => line(`${ok ? ansi('32', '✓') : required ? ansi('31', '✗') : ansi('33', '○')} ${name}${!ok && !required ? ' · not installed on this machine' : ''}`));
  line();
  providers.forEach((p) => {
    const c = providerConfig(cfg, p.id);
    line(`${p.label.padEnd(10)} ${c.apiKey && c.model ? green('saved') : dim('not configured')}${c.model ? ` · ${truncate(c.model, 42)}` : ''}`);
  });
  const activeCfg = activeProvider(cfg); const activePc = providerConfig(cfg, activeCfg.id);
  line(); line(`Active       ${activeCfg.label}${activePc.model ? ` · ${activePc.model}` : ' · not configured'}`);
  line(`Policy        ${green('artifact guard')} · ${green('prompt context')} · ${green('shell guard')} · ${green('response economy')}`);
  line(`Economy       ${efficiencyStatus().active ? green('active · ~75% avoidable prose target') : red('missing')}`);
  if (providerConfig(cfg, 'openrouter').apiKey) line(dim(`OpenRouter free routing: ${OPENROUTER_FREE_MODEL} + live free fallback candidates`));
}
async function listSkills() {
  for (const [name, description] of skills) line(`${ansi('34', '/skill:')}${name}  ${description}`);
}
async function help() {
  clearScreen();
  title(`Lazy Developer ${version}`);
  line(`${ansi('1;36','◆')} Command center`);
  line(`${dim('Build · debug · review · test · ship')}`);
  line();
  line(`  ${ansi('36','lazydev chat'.padEnd(24))} Start the LazyDev + Kimi Code session`);
  line(`  ${ansi('36','lazydev setup'.padEnd(24))} Choose your provider, API key, and model`);
  line(`  ${ansi('36','lazydev sessions'.padEnd(24))} Work with saved Kimi sessions`);
  line(`  ${ansi('36','lazydev skills'.padEnd(24))} Browse bundled LazyDev skills`);
  line(`  ${ansi('36','lazydev artifact'.padEnd(24))} Work with a standalone artifact path`);
  line(`  ${ansi('36','lazydev env'.padEnd(24))} Inspect the current runtime environment`);
  line(`  ${ansi('36','lazydev universal'.padEnd(24))} Show universal integration details`);
  line(`  ${ansi('36','lazydev ui <brief>'.padEnd(24))} Generate a searchable design system before UI implementation`);
  line(`  ${ansi('36','lazydev lang'.padEnd(24))} Detect TypeScript/Go and show the active coding contract`);
  line(`  ${ansi('36','lazydev doctor'.padEnd(24))} Check installation and configuration`);
  line(`  ${ansi('36','lazydev version'.padEnd(24))} Show the installed version`);
  line();
  line(dim('Run `lazydev chat` when you are ready to open the coding session.'));
}

function commandExists(command) {
  const probe = isWin ? 'where' : 'which';
  try { return spawnSync(probe, [command], { encoding: 'utf8' }).status === 0; } catch { return false; }
}
function readCliConfig() {
  const cfg = normalizeConfig(readConfig());
  const cli = cfg.cli && typeof cfg.cli === 'object' ? cfg.cli : {};
  const command = String(cli.command || '').trim();
  const args = Array.isArray(cli.args) ? cli.args.map(String) : [];
  return { command, args };
}
function findAvailableAgentCli() {
  const configured = readCliConfig();
  if (configured.command) return configured;
  const candidates = isWin
    ? ['kimi.cmd', 'claude.cmd', 'codex.cmd', 'gemini.cmd', 'opencode.cmd', 'qoder.cmd']
    : ['kimi', 'claude', 'codex', 'gemini', 'opencode', 'qoder'];
  for (const command of candidates) if (commandExists(command)) return { command, args: [] };
  return null;
}
async function chat() {
  clearScreen();
  if (!ensureKimiInstalled()) return;
  const cfg = normalizeConfig(readConfig());
  const provider = activeProvider(cfg);
  const savedPc = providerConfig(cfg, provider.id);
  let pc = { ...savedPc, toolUse: modelSupportsKimiTools(provider, savedPc) };
  if (!pc.apiKey || !pc.model) { line(red(`No active provider is configured. Run: lazydev setup`)); return; }
  let openRouterModels = [];
  if (provider.id === 'openrouter') {
    const live = await verifyLiveModel(provider, pc);
    if (live.status === 'missing' || live.status === 'no-tools') {
      line(red(`OpenRouter model check failed: ${pc.model} is not currently exposed as a tool-capable live model.`));
      line(dim(`Run: lazydev setup → OpenRouter → choose a current model from the live catalog.`));
      return;
    }
    openRouterModels = live.models || [];
  }
  // Gemini and Anthropic use their native Kimi provider types; the other providers are normalized through the local compatibility proxy where needed.
  const freeFallbacks = provider.id === 'openrouter' && (pc.model === OPENROUTER_FREE_MODEL || /:free$/i.test(pc.model))
    ? buildOpenRouterFreeFallbacks(pc.model, openRouterModels)
    : [];
  if (isAntigravityModel(pc.model)) {
    line(red('That model is temporarily disabled in LazyDev. Choose another configured provider/model with `lazydev setup`.'));
    return;
  }
  // Route every remote provider through the same loopback proxy so transient retry, request
  // normalization, and token compression apply consistently. Ollama stays direct because it is
  // local by design and has no provider-side availability or billing layer to protect.
  pc.modelInfo = effectiveModelInfo(provider, pc);
  const proxy = !['ollama', 'gemini', 'anthropic'].includes(provider.id)
    ? await createProxy(provider, pc, { freeFallbacks })
    : null;
  const sessionAliases = discoverSessionModelAliases(`lazydev/${pc.model}`);
  if (provider.id === 'ollama') assertHttpUrl(ollamaChatUrl(pc.baseUrl), 'Ollama API URL');
  else if (provider.id === 'gemini') {
    // Standard Gemini models use Kimi Code's native Google GenAI adapter.
  } else if (provider.id === 'anthropic') assertHttpUrl('https://api.anthropic.com', 'Anthropic API URL');
  else if (provider.id === 'openai') assertHttpUrl('https://api.openai.com/v1', 'OpenAI API URL');
  else if (proxy) assertHttpUrl(`http://127.0.0.1:${proxy.port}/v1`, 'LazyDev proxy URL');
  else assertHttpUrl(provider.chatUrl, `${provider.label} API URL`);
  fs.mkdirSync(kimiHome(), { recursive: true, mode: 0o700 });
  const configPath = path.join(kimiHome(), 'config.toml');
  const tuiPath = path.join(kimiHome(), 'tui.toml');
  fs.writeFileSync(configPath, composeLazyDevConfig(provider, pc, proxy, sessionAliases), { mode: 0o600 });
  fs.writeFileSync(tuiPath, buildTuiConfig(), { mode: 0o600 });
  writeKimiAgentGuidance();
  writeLazyDevMcpConfig();
  const invocation = findKimiInvocation();
  if (!invocation) { try { proxy?.server.close(); } catch {} line(red(`Kimi Code launcher not found. Install Kimi Code ${KIMI_VERSION} with the LazyDev installer.`)); return; }
  // Kimi Code standalone resolves its managed runtime from KIMI_CODE_HOME.
  // Do not pass the legacy explicit-config flag: recent standalone builds
  // resolve their runtime config from KIMI_CODE_HOME instead.
  // The config written above is therefore the canonical runtime configuration.
  const artifactDir = ensureOutputDirectory();
  const launchArgs = [...invocation.args, '--add-dir', artifactDir];
  const workDirIndex = process.argv.indexOf('--work-dir');
  if (workDirIndex >= 0 && process.argv[workDirIndex + 1]) launchArgs.push('--work-dir', process.argv[workDirIndex + 1]);
  const mode = process.argv.includes('--new') ? 'new' : process.argv.includes('--sessions') || process.argv.includes('--session') ? 'sessions' : process.argv.includes('--resume') || process.argv.includes('--continue') ? 'continue' : 'new';
  if (mode === 'sessions') launchArgs.push('--session');
  else if (mode === 'continue') launchArgs.push('--continue');
  else launchArgs.push('--agent', 'default');
  const budget = contextBudget(pc.modelInfo);
  const authBridgeStop = startKimiAuthBridge({ configPath, provider, pc, proxy, sessionAliases });
  // The runtime model override keeps the selected LazyDev route stable during the child TUI.
  const modelEnv = proxy ? buildKimiModelEnv(provider, pc, proxy, budget) : {};
  const childEnv = {
    ...sanitizeKimiChildEnv(provider),
    ...modelEnv,
    KIMI_CODE_HOME: kimiHome(),
    KIMI_CODE_NO_AUTO_UPDATE: '1',
    KIMI_LOOP_MAX_STEPS_PER_TURN: '0',
    LAZYDEV_ARTIFACT_DIR: outputDirectory(),
    LAZYDEV_VERSION: version,
    LAZYDEV_MODEL: pc.model,
  };
  const child = spawn(invocation.command, launchArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: childEnv,
    windowsHide: false,
  });
  const shutdown = () => { try { authBridgeStop(); } catch {} try { proxy?.server.close(); } catch {} };
  child.on('exit', (code, signal) => { shutdown(); if (signal) process.exitCode = 1; else process.exitCode = code ?? 0; });
  child.on('error', (error) => { shutdown(); line(red(`Kimi Code failed to start: ${error.message}`)); process.exitCode = 1; });
  process.on('exit', shutdown);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) return help();
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'version' || cmd === '--version' || cmd === '-v') return console.log(version);
  if (cmd === 'path') return console.log(root);
  if (cmd === 'skills') return listSkills();
  if (cmd === 'doctor') return doctor();
  if (cmd === 'env' || cmd === 'info' || cmd === 'universal') return envInfo(process.argv.includes('--json'));
  if (cmd === 'ui') return uiCommand(process.argv.slice(3));
  if (cmd === 'lang' || cmd === 'languages') return languageCommand(process.argv.slice(3));
  if (cmd === 'artifact' || cmd === 'artifacts') return artifactCommand(process.argv[3]);
  if (cmd === 'setup') return setup();
  if (cmd === 'chat') return chat();
  if (cmd === 'sessions') { process.argv.splice(2, 1, 'chat'); process.argv.push('--sessions'); return chat(); }
  line(red(`Unknown command: ${cmd}`));
  await help();
  process.exitCode = 1;
}
try {
  await main();
} catch (error) {
  if (error?.code === 'LAZYDEV_INPUT_INTERRUPTED') {
    process.exitCode = 130;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
}
