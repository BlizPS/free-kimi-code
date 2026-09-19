#!/usr/bin/env node

/**
 * LazyDev Browser MCP server.
 *
 * Dependency-free stdio MCP server for public web search/fetch operations.
 * It deliberately returns transport failures as normal tool results instead
 * of JSON-RPC protocol errors so a temporary network outage does not abort a
 * coding session.
 *
 * This file is source-compatible with Node/Bun/Deno-style runtimes. LazyDev's
 * default no-Node installation path does not require this file; a native
 * Python adapter is provided separately for Kimi environments without Node.
 */

import readline from 'node:readline';
import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';

const VERSION = '1.0.0';
const USER_AGENT = process.env.LAZYDEV_BROWSER_USER_AGENT || `LazyDev-Browser/${VERSION}`;
const REQUEST_TIMEOUT_MS = clampInt(process.env.LAZYDEV_BROWSER_TIMEOUT_MS, 15000, 3000, 60000);
const MAX_TEXT_CHARS = clampInt(process.env.LAZYDEV_BROWSER_MAX_CHARS, 50000, 2048, 200000);
const MAX_RESULTS = clampInt(process.env.LAZYDEV_BROWSER_MAX_RESULTS, 8, 1, 20);
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const FETCH_CACHE_TTL_MS = 30 * 1000;
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

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonReply(id, result = {}, error = null) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    ...(error ? { error } : { result }),
  });
}

function toolResult(text, structuredContent, isError = false) {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
    ...(isError ? { isError: true } : {}),
  };
}

function unavailableToolResult(message, diagnostics = []) {
  return toolResult(
    `[LazyDev browser] ${message}`,
    { status: 'unavailable', retryable: true, diagnostics: diagnostics.slice(0, 3) },
    true,
  );
}

function cleanCache(cacheMap) {
  const now = Date.now();
  for (const [key, value] of cacheMap) {
    if (value.expiresAt <= now) cacheMap.delete(key);
  }
}

function normalizeUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error('Invalid URL. Use an absolute http:// or https:// URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.');
  }
  return parsed;
}

async function assertSafeRemoteHost(url) {
  if (process.env.LAZYDEV_BROWSER_ALLOW_PRIVATE === '1') return;
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1') {
    throw new Error('Private/local hosts are disabled by default. Set LAZYDEV_BROWSER_ALLOW_PRIVATE=1 to allow them.');
  }
  if (net.isIP(hostname)) {
    const addr = hostname;
    if (isPrivateIp(addr)) {
      throw new Error('Private/local IP addresses are disabled by default.');
    }
    return;
  }
  const records = await dns.lookup(hostname, { all: true });
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error('Host resolves to a private/local IP address and is blocked by default.');
    }
  }
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

async function fetchText(url, redirects = 0) {
  if (redirects > 4) throw new Error('Too many redirects.');
  await assertSafeRemoteHost(url);
  const cacheKey = url.href;
  cleanCache(cache);
  const cached = cache.get(`fetch:${cacheKey}`);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const payload = await requestViaHttp(url);
  const result = {
    url: payload.url,
    status: payload.status,
    contentType: payload.contentType,
    body: payload.body.slice(0, MAX_TEXT_CHARS),
    truncated: payload.body.length > MAX_TEXT_CHARS,
  };
  cache.set(`fetch:${cacheKey}`, { expiresAt: Date.now() + FETCH_CACHE_TTL_MS, payload: result });
  return result;
}

function requestViaHttp(url) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,text/plain,text/markdown,application/json;q=0.9,*/*;q=0.5',
        'accept-language': 'en-US,en;q=0.8',
      },
    }, (response) => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        resolve(fetchText(new URL(location, url), 1));
        return;
      }
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        chunks.push(chunk);
        if (chunks.join('').length > MAX_TEXT_CHARS * 2) response.destroy();
      });
      response.on('end', () => {
        const body = chunks.join('');
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        resolve({
          url: url.href,
          status,
          contentType: String(response.headers['content-type'] || ''),
          body,
        });
      });
      response.on('error', reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`)));
    request.on('error', reject);
  });
}

async function fetchWithRetry(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await sleep(250);
    }
  }
  throw lastError || new Error('fetch unavailable');
}

async function searchWeb(query) {
  if (process.env.LAZYDEV_BROWSER_TEST_UNAVAILABLE === '1') {
    return unavailableToolResult('Web search is temporarily unavailable in test mode.', ['simulated network outage']);
  }
  const q = String(query || '').trim();
  if (!q) return unavailableToolResult('Search query is required.');
  cleanCache(cache);
  const cached = cache.get(`search:${q.toLowerCase()}`);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const failures = [];
  for (const engine of SEARCH_ENGINES) {
    try {
      const page = await fetchWithRetry(new URL(engine.buildUrl(q)));
      const results = engine.parse(page.body).slice(0, MAX_RESULTS);
      if (!results.length) throw new Error('no results parsed');
      const result = toolResult(
        `Search results for: ${q}\nSource: ${engine.id}\n${results.map((item, i) => `${i + 1}. ${item.title}\n   ${item.url}`).join('\n')}`,
        { status: 'ok', query: q, source: engine.id, results },
      );
      cache.set(`search:${q.toLowerCase()}`, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, payload: result });
      return result;
    } catch (error) {
      failures.push(`${engine.id}: ${error?.message || String(error)}`);
    }
  }
  return unavailableToolResult('Web search is temporarily unavailable. Continue with native WebSearch/FetchURL or local project context.', failures);
}

async function browserOpen(urlValue) {
  try {
    const url = normalizeUrl(urlValue);
    const page = await fetchWithRetry(url);
    const parsed = parseHtmlDocument(page.body, page.contentType);
    return toolResult(
      `${parsed.title ? `Title: ${parsed.title}\n` : ''}URL: ${page.url}\n\n${parsed.text}`,
      {
        status: 'ok',
        url: page.url,
        statusCode: page.status,
        contentType: page.contentType,
        title: parsed.title,
        text: parsed.text,
        links: parsed.links,
        truncated: page.truncated,
      },
    );
  } catch (error) {
    return unavailableToolResult(`Unable to open URL: ${error?.message || String(error)}`);
  }
}

async function browserLinks(urlValue) {
  try {
    const url = normalizeUrl(urlValue);
    const page = await fetchWithRetry(url);
    const parsed = parseHtmlDocument(page.body, page.contentType);
    return toolResult(
      `Links from ${page.url}\n${parsed.links.map((item, i) => `${i + 1}. ${item.text || '(no text)'}\n   ${item.url}`).join('\n') || '(no links found)'}`,
      { status: 'ok', url: page.url, links: parsed.links },
    );
  } catch (error) {
    return unavailableToolResult(`Unable to extract links: ${error?.message || String(error)}`);
  }
}

function parseHtmlDocument(body, contentType) {
  const isText = /text\/plain|text\/markdown|application\/json/i.test(String(contentType || ''));
  if (isText) return { title: '', text: body.slice(0, MAX_TEXT_CHARS), links: [] };
  const title = stripHtml((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const links = [];
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of body.matchAll(linkRe)) {
    try {
      const linkUrl = new URL(decodeHtml(match[1]), 'https://example.invalid').href;
      if (linkUrl === 'https://example.invalid/') continue;
      links.push({ text: stripHtml(match[2]).slice(0, 300), url: linkUrl });
    } catch {}
    if (links.length >= 100) break;
  }
  const text = stripHtml(body)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  return { title, text, links };
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

function normalizeResultUrl(value) {
  const href = decodeHtml(value);
  try {
    const url = new URL(href, 'https://html.duckduckgo.com');
    return url.searchParams.get('uddg') || url.href;
  } catch {
    return href;
  }
}

function uniqueResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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

function listTools() {
  return {
    tools: [
      {
        name: 'search_web',
        description: 'Search the public web. Temporary network failures return a normal tool result instead of an MCP protocol error.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Web search query' } },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        name: 'browser_open',
        description: 'Fetch a public HTTP(S) URL and extract readable text, title, and links.',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string', description: 'Absolute HTTP(S) URL' } },
          required: ['url'],
          additionalProperties: false,
        },
      },
      {
        name: 'browser_links',
        description: 'Extract links from a public HTTP(S) URL.',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string', description: 'Absolute HTTP(S) URL' } },
          required: ['url'],
          additionalProperties: false,
        },
      },
    ],
  };
}

async function handleRequest(request) {
  const { id, method, params = {} } = request;
  if (method === 'initialize') {
    return jsonReply(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'lazydev-browser', version: VERSION },
    });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return null;
  if (method === 'ping') return jsonReply(id, {});
  if (method === 'tools/list') return jsonReply(id, listTools());
  if (method === 'tools/call') {
    const name = String(params.name || '');
    const args = params.arguments || {};
    let result;
    if (name === 'search_web') result = await searchWeb(args.query);
    else if (name === 'browser_open') result = await browserOpen(args.url);
    else if (name === 'browser_links') result = await browserLinks(args.url);
    else return jsonReply(id, null, { code: -32602, message: `Unknown tool: ${name}` });
    return jsonReply(id, result);
  }
  return jsonReply(id, null, { code: -32601, message: `Method not found: ${method}` });
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  Promise.resolve(handleRequest(request))
    .then((response) => {
      if (response) process.stdout.write(`${response}\n`);
    })
    .catch((error) => {
      if (request && request.id !== undefined) {
        process.stdout.write(`${jsonReply(request.id, null, { code: -32000, message: String(error?.message || error) })}\n`);
      }
    });
});
