#!/usr/bin/env node
import readline from 'node:readline';
import https from 'node:https';

const USER_AGENT = process.env.LAZYDEV_SEARCH_USER_AGENT || 'LazyDev/1.0.0';
const REQUEST_TIMEOUT_MS = 9000;
const MAX_RESULTS = 8;
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map();

const SEARCH_ENGINES = [
  {
    id: 'duckduckgo-html',
    buildUrl: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    parse: parseDuckDuckGoHtml,
  },
  {
    id: 'duckduckgo-lite',
    buildUrl: (q) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
    parse: parseDuckDuckGoLite,
  },
  {
    id: 'bing',
    buildUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    parse: parseBing,
  },
];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function requestText(url) {
  const headers = {
    'user-agent': USER_AGENT,
    accept: 'text/html,application/xhtml+xml',
    'accept-language': 'en-US,en;q=0.8',
  };
  let firstError;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    firstError = error;
  }

  try {
    return await httpsRequestText(url, headers);
  } catch (error) {
    const reason = error?.message || String(error);
    const first = firstError?.message || String(firstError);
    throw new Error(`${first}; fallback request: ${reason}`);
  }
}

function httpsRequestText(url, headers) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = chunks.join('');
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        resolve(text);
      });
      response.on('error', reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
  });
}

async function fetchEngine(engine, query) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const html = process.env.LAZYDEV_SEARCH_TEST_UNAVAILABLE === '1'
        ? (() => { throw new Error('simulated unavailable search service'); })()
        : await requestText(engine.buildUrl(query));
      const results = engine.parse(html).slice(0, MAX_RESULTS);
      if (results.length) return results;
      lastError = new Error('no results parsed');
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await sleep(250);
  }
  throw lastError || new Error('search unavailable');
}

async function searchWeb(query) {
  const q = String(query || '').trim();
  if (!q) return unavailableResult('Search query is required.');

  const cached = cache.get(q.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  if (cached) cache.delete(q.toLowerCase());

  const failures = [];
  for (const engine of SEARCH_ENGINES) {
    try {
      const results = await fetchEngine(engine, q);
      const payload = formatResults(q, engine.id, results);
      cache.set(q.toLowerCase(), { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      return payload;
    } catch (error) {
      failures.push(`${engine.id}: ${error?.message || 'unavailable'}`);
    }
  }

  return unavailableResult(
    'Web search is temporarily unavailable from the LazyDev fallback service. Continue with any native WebSearch/FetchURL capability available, or proceed using verified local/project context without treating this as a provider failure.',
    failures,
  );
}

function formatResults(query, engine, results) {
  const text = results.map((item, i) => `${i + 1}. ${item.title}\n   ${item.url}`).join('\n');
  return {
    content: [{ type: 'text', text: `Search results for: ${query}\nSource: ${engine}\n${text}` }],
    structuredContent: { status: 'ok', query, source: engine, results },
  };
}

function unavailableResult(message, failures = []) {
  const suffix = failures.length ? `\n${failures.join('\n')}` : '';
  return {
    content: [{ type: 'text', text: `[LazyDev search fallback] ${message}${suffix}` }],
    structuredContent: { status: 'unavailable', retryable: true, results: [], diagnostics: failures.slice(0, 3) },
  };
}

function parseDuckDuckGoHtml(html) {
  const results = [];
  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const url = normalizeResultUrl(match[1]);
    const title = stripHtml(match[2]);
    if (url && title) results.push({ title, url });
  }
  return uniqueResults(results);
}

function parseDuckDuckGoLite(html) {
  const results = [];
  const re = /<a[^>]+class=["']result-link["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const url = normalizeResultUrl(match[1]);
    const title = stripHtml(match[2]);
    if (url && title) results.push({ title, url });
  }
  return uniqueResults(results);
}

function parseBing(html) {
  const results = [];
  const re = /<li[^>]+class=["'][^"']*b_algo[^"']*["'][\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const url = normalizeResultUrl(match[1]);
    const title = stripHtml(match[2]);
    if (url && title) results.push({ title, url });
  }
  return uniqueResults(results);
}

function uniqueResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function normalizeResultUrl(value) {
  const href = decodeHtml(value);
  try {
    const url = new URL(href, 'https://html.duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? target : url.href;
  } catch { return href; }
}

function stripHtml(value) {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function reply(id, result = {}, error) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    ...(error ? { error: { code: -32000, message: String(error.message || error) } } : { result }),
  });
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  const { id, method, params = {} } = request;
  try {
    if (method === 'initialize') {
      process.stdout.write(`${reply(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'lazydev-search', version: '1.0.0' } })}\n`);
    } else if (method === 'notifications/initialized') {
      return;
    } else if (method === 'ping') {
      process.stdout.write(`${reply(id, {})}\n`);
    } else if (method === 'tools/list') {
      process.stdout.write(`${reply(id, { tools: [{ name: 'search_web', description: 'Search the public web for current or external information. Temporary network outages return a normal degraded result instead of an MCP protocol error.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'], additionalProperties: false } }] })}\n`);
    } else if (method === 'tools/call') {
      const name = String(params.name || '');
      if (name !== 'search_web') throw new Error(`Unknown tool: ${name}`);
      const result = await searchWeb(params.arguments?.query);
      process.stdout.write(`${reply(id, result)}\n`);
    }
  } catch (error) {
    // Protocol-level errors remain reserved for malformed/unknown RPC requests.
    // Search transport failures are converted into normal degraded tool results.
    process.stdout.write(`${reply(id, {}, error)}\n`);
  }
});
