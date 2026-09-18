#!/usr/bin/env node
import readline from 'node:readline';

const USER_AGENT = process.env.LAZYDEV_SEARCH_USER_AGENT || 'LazyDev/1.0.0';
const SEARCH_URL = 'https://html.duckduckgo.com/html/?q=';

async function searchWeb(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query is required.');
  const response = await fetch(`${SEARCH_URL}${encodeURIComponent(q)}`, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    redirect: 'follow',
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`Search request failed with HTTP ${response.status}.`);
  const results = [];
  const re = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const url = normalizeResultUrl(match[1]);
    const title = stripHtml(match[2]);
    if (!url || !title) continue;
    results.push({ title, url });
    if (results.length >= 8) break;
  }
  if (!results.length) return `No search results found for: ${q}`;
  return results.map((item, i) => `${i + 1}. ${item.title}\n   ${item.url}`).join('\n');
}

function normalizeResultUrl(value) {
  const href = decodeHtml(value);
  try {
    const url = new URL(href, 'https://html.duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? target : url.href;
  } catch { return href; }
}

function stripHtml(value) { return decodeHtml(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function decodeHtml(value) { return String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }

function reply(id, result = {}, error) {
  return JSON.stringify({ jsonrpc: '2.0', id, ...(error ? { error: { code: -32000, message: String(error.message || error) } } : { result }) });
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
      process.stdout.write(`${reply(id, { tools: [{ name: 'search_web', description: 'Search the public web for current or external information.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'], additionalProperties: false } }] })}\n`);
    } else if (method === 'tools/call') {
      const name = String(params.name || '');
      if (name !== 'search_web') throw new Error(`Unknown tool: ${name}`);
      const text = await searchWeb(params.arguments?.query);
      process.stdout.write(`${reply(id, { content: [{ type: 'text', text }] })}\n`);
    }
  } catch (error) {
    process.stdout.write(`${reply(id, {}, error)}\n`);
  }
});
