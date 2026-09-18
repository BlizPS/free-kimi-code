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
import { platformPaths } from '../runtime/platform-policy.mjs';
import { modelIntelligenceProfile, buildIntelligenceAliasSystem } from '../runtime/intelligence-kernel.mjs';

const version = '1.0.0';
const TOKEN_SAVINGS_FLOOR = 0.75;
const TOKEN_SAVINGS_TARGET = 0.80;
const MAX_SKILL_FRACTION = 0.24;
const KIMI_PACKAGE = '@moonshot-ai/kimi-code';
const KIMI_VERSION = '0.43.1';
const OPENROUTER_FREE_MODEL = 'openrouter/free';
const OPENROUTER_MODEL_FALLBACK_LIMIT = 3;
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
  { id: 'openai', label: 'OpenAI', kind: 'openai_responses', modelsUrl: 'https://api.openai.com/v1/models', env: 'OPENAI_API_KEY' },
  { id: 'anthropic', label: 'Anthropic', kind: 'anthropic', modelsUrl: 'https://api.anthropic.com/v1/models', env: 'ANTHROPIC_API_KEY' },
];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const platform = platformPaths();
const isTermux = platform.termux;
const localRequire = createRequire(import.meta.url);
function outputDirectory() {
  return platform.artifactDirectory;
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
function normalizeConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? { ...raw } : {};
  const p = cfg.providers && typeof cfg.providers === 'object' ? { ...cfg.providers } : {};
  if (!p.gemini && (typeof cfg.apiKey === 'string' || typeof cfg.model === 'string')) {
    p.gemini = { apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey.trim() : '', model: typeof cfg.model === 'string' && cfg.model.trim() ? cfg.model.trim() : 'gemini-flash-lite-latest' };
  }
  cfg.providers = p;
  if (!providers.some((x) => x.id === cfg.activeProvider)) cfg.activeProvider = 'gemini';
  delete cfg.apiKey; delete cfg.model;
  return cfg;
}
function writeConfig(data) { writeJsonAtomic(configFile(), data); }
function providerConfig(cfg, id) { const x = cfg.providers?.[id]; return x && typeof x === 'object' ? x : {}; }
function activeProvider(cfg) { return providers.find((x) => x.id === cfg.activeProvider) || providers[1]; }
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

function prompt(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const chunks = [];
    const onData = (buf) => {
      const text = String(buf);
      const idx = text.indexOf('\n');
      if (idx >= 0) {
        chunks.push(text.slice(0, idx));
        cleanup();
        resolve(chunks.join('').replace(/\r$/, ''));
      } else chunks.push(text);
    };
    const cleanup = () => process.stdin.off('data', onData);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

function requestJson(urlString, { method = 'GET', headers = {}, body, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request({ protocol: url.protocol, hostname: url.hostname, port: url.port || 443, path: `${url.pathname}${url.search}`, method, headers: { accept: 'application/json', ...headers }, timeout }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let data = null; try { data = text ? JSON.parse(text) : {}; } catch {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${res.statusCode}: ${data?.error?.message || data?.message || text.slice(0, 500) || 'request failed'}`));
          return;
        }
        resolve(data ?? {});
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Request timed out after ${timeout}ms.`)));
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

function knownModelInfo(_id) { return {}; }
function normalizeModel(item, provider) {
  const id = String(provider.kind === 'gemini' ? item.name || '' : item.id || '').replace(/^models\//, '');
  const known = knownModelInfo(id);
  if (provider.kind === 'gemini') {
    return { id, name: String(item.displayName || item.name || id), inputLimit: Number(item.inputTokenLimit) || known.inputLimit || null, outputLimit: Number(item.outputTokenLimit) || known.outputLimit || null, contextLimit: Number(item.inputTokenLimit) || known.contextLimit || null, live: true, supportedActions: Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : [] };
  }
  if (provider.kind === 'anthropic') {
    const capabilities = item.capabilities && typeof item.capabilities === 'object' ? item.capabilities : {};
    const toolUse = capabilities.tool_use?.supported === true || capabilities.tools?.supported === true;
    return { id, name: String(item.display_name || item.name || id), inputLimit: Number(item.max_input_tokens) || known.inputLimit || null, outputLimit: Number(item.max_tokens) || known.outputLimit || null, contextLimit: Number(item.max_input_tokens) || known.contextLimit || null, live: true, capabilities, toolUse };
  }
  const supportedParameters = Array.isArray(item.supported_parameters) ? item.supported_parameters : null;
  const pricing = item.pricing && typeof item.pricing === 'object' ? item.pricing : {};
  const isFree = id === OPENROUTER_FREE_MODEL || /:free$/i.test(id) || (provider.id === 'openrouter' && String(pricing.prompt ?? '') === '0' && String(pricing.completion ?? '') === '0');
  const toolUse = supportedParameters ? supportedParameters.includes('tools') : null;
  return { id, name: String(item.name || item.id || id), inputLimit: Number(item.context_length) || known.inputLimit || null, outputLimit: Number(item.top_provider?.max_completion_tokens) || Number(item.max_completion_tokens) || known.outputLimit || null, contextLimit: Number(item.context_length) || known.contextLimit || null, live: true, supportedParameters, toolUse, isFree, pricing };
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
async function fetchModels(provider, apiKey) {
  if (provider.kind === 'gemini') {
    const data = await requestJson(`${provider.modelsUrl}?key=${encodeURIComponent(apiKey)}&pageSize=1000`);
    return (Array.isArray(data.models) ? data.models : []).filter((x) => Array.isArray(x.supportedGenerationMethods) && x.supportedGenerationMethods.includes('generateContent')).map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  }
  if (provider.kind === 'anthropic') {
    const data = await requestJson(provider.modelsUrl, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'user-agent': `lazydev/${version}` } });
    return (Array.isArray(data.data) ? data.data : []).map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  }
  const data = await requestJson(provider.modelsUrl, { headers: { Authorization: `Bearer ${apiKey}`, 'user-agent': `lazydev/${version}` } });
  const list = Array.isArray(data.data) ? data.data : [];
  if (provider.id !== 'openrouter') return list.map((x) => normalizeModel(x, provider)).filter((x) => x.id);
  // OpenRouter documents `openrouter/free` as a dedicated router endpoint.
  // It may not appear as an ordinary `/api/v1/models` record, so keep it
  // explicitly visible and use the live catalog only for the fallback pool.
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
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const nativeCandidates = isWin
    ? [path.join(home, '.kimi-code', 'bin', 'kimi.exe'), path.join(home, '.local', 'bin', 'kimi.exe')]
    : [path.join(home, '.kimi-code', 'bin', 'kimi'), path.join(home, '.local', 'bin', 'kimi')];
  for (const candidate of nativeCandidates) {
    try { if (fs.existsSync(candidate)) return { command: candidate, args: [] }; } catch {}
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
    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
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
      // Kimi Code attaches OpenAI-only extras (e.g. prompt caching hints) to every
      // request regardless of backend. OpenRouter ignores fields it doesn't
      // recognize, but stricter OpenAI-compatible validators (e.g. NVIDIA's)
      // reject the request outright with 400 Validation errors. Strip anything
      // not part of the standard chat completions schema before forwarding.
      for (const field of UNSUPPORTED_PASSTHROUGH_FIELDS) delete body[field];
      const payload = JSON.stringify(body);
      const target = new URL(provider.chatUrl);
      const headers = {
        'content-type': 'application/json',
        'accept': req.headers.accept || 'application/json',
        'authorization': `Bearer ${pc.apiKey}`,
        'user-agent': `lazydev/${version}`,
        'content-length': Buffer.byteLength(payload)
      };
      const transport = target.protocol === 'http:' ? http : https;
      const upstream = transport.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers
      }, upstreamRes => {
        res.statusCode = upstreamRes.statusCode || 502;
        if (provider.id === 'openrouter' && (res.statusCode === 404 || res.statusCode === 429)) {
          let errorBody = '';
          upstreamRes.setEncoding('utf8');
          upstreamRes.on('data', chunk => { errorBody += chunk; });
          upstreamRes.on('end', () => {
            const lower = errorBody.toLowerCase();
            if (lower.includes('no endpoints found') && lower.includes('tool use')) {
              res.statusCode = 503;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ error: { message: `OpenRouter has no live endpoint for ${pc.model} that satisfies Kimi Code tool use. Use openrouter/free or rerun lazydev setup.` } }));
              return;
            }
            if (res.statusCode === 429) {
              const retryAfter = upstreamRes.headers['retry-after'];
              res.statusCode = 503;
              res.setHeader('content-type', 'application/json');
              const retryHint = retryAfter ? ` Retry-After: ${retryAfter}s.` : '';
              const fallbackHint = /:free$/i.test(pc.model) || pc.model === OPENROUTER_FREE_MODEL
                ? ' Free-model fallbacks were requested; all eligible endpoints may currently be rate-limited.'
                : ' OpenRouter provider failover was enabled for this model.';
              res.end(JSON.stringify({ error: { message: `OpenRouter is rate-limited for ${pc.model}.${retryHint}${fallbackHint}` } }));
              return;
            }
            res.end(errorBody);
          });
          return;
        }
        for (const [key, value] of Object.entries(upstreamRes.headers)) {
          if (value != null && !['content-length','connection','transfer-encoding'].includes(key.toLowerCase())) res.setHeader(key, value);
        }
        upstreamRes.pipe(res);
      });
      upstream.on('error', err => {
        if (!res.headersSent) {
          res.writeHead(502, {'content-type':'application/json'});
          res.end(JSON.stringify({error:{message:err.message}}));
        } else {
          try { res.destroy(err); } catch {}
        }
      });
      upstream.write(payload);
      upstream.end();
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

function ensureKimiInstalled() {
  const packageRoot = resolveKimiPackageRoot();
  if (packageRoot) return true;
  const launcher = findKimiInvocation();
  if (launcher) return true;
  console.error(red(`Lazy Developer requires Kimi Code ${KIMI_VERSION}.`));
  console.error('Install it with the Lazy Developer installer, then run: lazydev chat');
  console.error('macOS/Linux: curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.sh" | sh');
  console.error('Windows PowerShell: & ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.ps1")))');
  return false;
}
function tomlQuote(text) { return JSON.stringify(String(text)); }
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
function writeKimiAgentGuidance() {
  const dir = kimiHome();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const agents = path.join(dir, 'AGENTS.md');
  const body = `# LazyDev Runtime\n\n- Repository source stays in the active workspace.\n- Standalone deliverables use ${outputDirectory()} only.\n- On Termux that path is exactly /storage/emulated/0/lazydevfile.\n- Never report a file as saved until the final path is verified.\n- Use the smallest relevant evidence set and the relevant LazyDev Skill.\n- Avoid filler, generic UI decoration, fake data, unnecessary rewrites, and repeated context.\n`;
  fs.writeFileSync(agents, body, { mode: 0o600 });

  const system = path.join(dir, 'SYSTEM.md');
  const source = runtimePolicyPath('SYSTEM.md');
  const bodyText = fs.readFileSync(source, 'utf8').trimEnd();
  const aliasSystem = buildIntelligenceAliasSystem();
  fs.writeFileSync(system, `${bodyText}\n\n${aliasSystem}\n`, { mode: 0o600 });
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
function contextBudget(modelInfo = {}) {
  const max = Math.max(32768, Number(modelInfo?.contextLimit) || Number(modelInfo?.inputLimit) || 131072);
  const output = Math.max(4096, Number(modelInfo?.outputLimit) || 8192);
  const reserve = Math.min(49152, Math.max(12000, Math.max(output * 2, Math.round(max * 0.08))));
  const input = Math.max(16384, max - reserve);
  const ratio = max >= 262144 ? 0.90 : 0.88;
  return { max, output, reserve, input, ratio };
}

function buildKimiConfig(provider, pc, proxy = null) {
  const alias = `lazydev/${pc.model}`;
  const budget = contextBudget(pc.modelInfo);
  const context = budget.max;
  const output = budget.output;
  const providerType = provider.id === 'gemini' ? 'google-genai' : provider.id === 'openai' ? 'openai_responses' : provider.id === 'anthropic' ? 'anthropic' : 'openai';
  const intelligence = modelIntelligenceProfile(pc.model);
  const modelCapabilities = provider.id === 'gemini' ? ['tool_use','thinking'] : ['tool_use'];
  const providerLines = provider.id === 'gemini'
    ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`api_key = ${tomlQuote(pc.apiKey)}`]
    : provider.id === 'openai'
      ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote('https://api.openai.com/v1')}`,`api_key = ${tomlQuote(pc.apiKey)}`]
      : provider.id === 'anthropic'
        ? [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote('https://api.anthropic.com')}`,`api_key = ${tomlQuote(pc.apiKey)}`]
        : [`[providers.lazydev]`,`type = ${tomlQuote(providerType)}`,`base_url = ${tomlQuote(`http://127.0.0.1:${proxy?.port}/v1`)}`,`api_key = ${tomlQuote(proxy?.token || '')}`];
  const artifactHook = path.join(root, 'hooks', 'lazydev-path-guard.mjs');
  const promptHook = path.join(root, 'hooks', 'lazydev-prompt-context.mjs');
  const shellHook = path.join(root, 'hooks', 'lazydev-shell-guard.mjs');
  const promptCommand = shellQuoteCommand(process.execPath, [promptHook]);
  const artifactCommand = shellQuoteCommand(process.execPath, [artifactHook]);
  const shellCommand = shellQuoteCommand(process.execPath, [shellHook]);
  return [
    `default_model = ${tomlQuote(alias)}`,
    `default_permission_mode = ${tomlQuote('manual')}`,
    `default_plan_mode = false`,
    `merge_all_available_skills = true`,
    `builtin_product_skills = false`,
    `telemetry = false`,
    `show_thinking_stream = false`,
    `database.base = true`,
    `database.search = true`,
    `extra_skill_dirs = [${tomlQuote(path.join(root, 'skills'))}]`,
    `extra_agent_dirs = [${tomlQuote(path.join(root, 'agents'))}]`,
    ``,
    ...providerLines,
    ``,
    `[models.${JSON.stringify(alias)}]`,
    `provider = ${tomlQuote('lazydev')}`,
    `model = ${tomlQuote(pc.model)}`,
    `max_context_size = ${Math.max(32768, context)}`,
    `max_input_size = ${Math.max(16384, budget.input)}`,
    `max_output_size = ${Math.max(256, output)}`, 
    `capabilities = ${JSON.stringify(modelCapabilities)}`,
    `display_name = ${tomlQuote(`${provider.label} · ${pc.model}`)}`,
    ``,
    `[thinking]`,
    `enabled = ${provider.id === 'gemini' ? 'true' : 'false'}`,
    ...(provider.id === 'gemini' ? [`effort = ${tomlQuote('low')}`] : []),
    ``,
    `[loop_control]`,
    `max_attempts_per_step = 2`,
    `max_steps_per_turn = 18`,
    `reserved_context_size = ${budget.reserve}`,
    `compaction_trigger_ratio = ${budget.ratio.toFixed(2)}`,
    `compaction_max_attempts = 2`,
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
    `event = ${tomlQuote('PreToolUse')}`,
    `matcher = ${tomlQuote('WriteFile|StrReplaceFile')}`,
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
    `[notifications]`,
    `enabled = true`,
    `notification_condition = "unfocused"`,
    ``,
    `[status_line]`,
    `items = ["mode", "goal", "model", "tasks", "cwd", "git", "tips"]`,
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
    const state = c.apiKey && c.model ? green('saved') : dim('not configured');
    line(`${i + 1}. ${p.label} · ${state}${c.model ? ` · ${truncate(c.model, 42)}` : ''}`);
  });
  line();
  const n = Number((await prompt('Provider [1-5]: ')).trim());
  if (!Number.isInteger(n) || n < 1 || n > 5) { line(red('Choose 1, 2, 3, 4, or 5.')); return; }
  const provider = providers[n - 1];
  const saved = providerConfig(cfg, provider.id);
  let apiKey = String(saved.apiKey || '').trim();
  if (apiKey) {
    const keep = (await prompt(`${provider.label} key saved. Keep it? [Y/n]: `)).trim().toLowerCase();
    if (keep && !['y', 'yes'].includes(keep)) apiKey = '';
  }
  if (!apiKey) apiKey = (await prompt(`${provider.label} API key: `)).trim();
  if (!apiKey) { line(yellow('Skipped: no API key entered.')); return; }
  process.stdout.write(`${provider.label} · loading live models ... `);
  try {
    const models = await fetchModels(provider, apiKey);
    process.stdout.write(green(`${models.length} found\n`));
    if (!models.length) throw new Error('No compatible models returned.');
    if (provider.id === 'openrouter') {
      const freeCount = models.filter((m) => m.isFree).length;
      line(dim(`OpenRouter · ${freeCount} free/tool-capable entries · ${OPENROUTER_FREE_MODEL} included`));
    }
    const current = String(saved.model || '');
    let index = Math.max(0, models.findIndex((m) => m.id === current));
    const chosen = await selectModel(models, index);
    cfg.providers[provider.id] = { apiKey, model: chosen.id, modelInfo: chosen };
    cfg.activeProvider = provider.id;
    writeConfig(cfg);
    line(green(`✓ ${provider.label} · saved`));
    line(green(`✓ ${chosen.id} · saved`));
    line();
  } catch (error) {
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
  await new Promise((resolve) => {
    const onKey = (_str, key = {}) => {
      if (key.name === 'up') { index = (index - 1 + models.length) % models.length; render(); }
      else if (key.name === 'down') { index = (index + 1) % models.length; render(); }
      else if (key.name === 'return' || key.name === 'enter') { done = true; process.stdin.off('keypress', onKey); try { process.stdin.setRawMode(false); } catch {} process.stdout.write('\n'); resolve(); }
    };
    process.stdin.on('keypress', onKey);
  });
  return models[index];
}
function readlineInputKeys() { try { import('node:readline').then((m) => m.emitKeypressEvents(process.stdin)); } catch {} }

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

async function doctor() {
  const cfg = normalizeConfig(readConfig());
  clearScreen();
  title(`Lazy Developer doctor · ${version}`);
  line(`Runtime       ${process.platform} · ${os.arch()} · Node ${process.version}`);
  line(`Agent CLI     ${findAvailableAgentCli()?.command || 'not detected'}`);
  line(`Skills        ${skills.length} bundled`);
  const token = readTokenStats();
  line(`Token gate    ${token.current}/${token.baseline} skill tokens · ${(token.reduction * 100).toFixed(1)}% reduction · floor ${(TOKEN_SAVINGS_FLOOR * 100).toFixed(0)}%+`);
  const active = activeProvider(cfg);
  const modelName = String(providerConfig(cfg, active.id).model || '');
  const intelligence = modelIntelligenceProfile(modelName);
  line(`Intelligence  ${intelligence.label} · ${intelligence.strategy} · effort ${intelligence.effort}`);
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
  line(`Policy        ${green('artifact guard')} · ${green('prompt context')} · ${green('shell guard')}`);
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
  const pc = providerConfig(cfg, provider.id);
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
  // Gemini uses Kimi Code's native google-genai protocol; OpenRouter/NVIDIA use the local compatibility proxy.
  const freeFallbacks = provider.id === 'openrouter' && (pc.model === OPENROUTER_FREE_MODEL || /:free$/i.test(pc.model))
    ? buildOpenRouterFreeFallbacks(pc.model, openRouterModels)
    : [];
  const proxy = ['openrouter','nvidia'].includes(provider.id) ? await createProxy(provider, pc, { freeFallbacks }) : null;
  fs.mkdirSync(kimiHome(), { recursive: true, mode: 0o700 });
  const configPath = path.join(kimiHome(), 'config.toml');
  const tuiPath = path.join(kimiHome(), 'tui.toml');
  fs.writeFileSync(configPath, buildKimiConfig(provider, pc, proxy), { mode: 0o600 });
  fs.writeFileSync(tuiPath, buildTuiConfig(), { mode: 0o600 });
  writeKimiAgentGuidance();
  const invocation = findKimiInvocation();
  if (!invocation) { try { proxy?.server.close(); } catch {} line(red(`Kimi Code launcher not found. Install Kimi Code ${KIMI_VERSION} with the LazyDev installer.`)); return; }
  // Kimi Code reads its managed configuration from KIMI_CODE_HOME.
  // LazyDev owns that directory and regenerates the provider/model config on each launch.
  const launchArgs = [...invocation.args];
  const workDirIndex = process.argv.indexOf('--work-dir');
  if (workDirIndex >= 0 && process.argv[workDirIndex + 1]) launchArgs.push('--work-dir', process.argv[workDirIndex + 1]);
  const mode = process.argv.includes('--new') ? 'new' : process.argv.includes('--sessions') || process.argv.includes('--session') ? 'sessions' : process.argv.includes('--resume') || process.argv.includes('--continue') ? 'continue' : 'new';
  if (mode === 'sessions') launchArgs.push('--session');
  else if (mode === 'continue') launchArgs.push('--continue');
  const child = spawn(invocation.command, launchArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      KIMI_CODE_HOME: kimiHome(),
      LAZYDEV_ARTIFACT_DIR: outputDirectory(),
      LAZYDEV_VERSION: version,
      LAZYDEV_MODEL: pc.model,
    },
    windowsHide: false,
  });
  const shutdown = () => { try { proxy?.server.close(); } catch {} };
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
  if (cmd === 'artifact' || cmd === 'artifacts') return artifactCommand(process.argv[3]);
  if (cmd === 'setup') return setup();
  if (cmd === 'chat') return chat();
  if (cmd === 'sessions') { process.argv.splice(2, 1, 'chat'); process.argv.push('--sessions'); return chat(); }
  line(red(`Unknown command: ${cmd}`));
  await help();
  process.exitCode = 1;
}
await main();
