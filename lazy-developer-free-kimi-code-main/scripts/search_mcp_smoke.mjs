import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'runtime', 'lazydev-web-search.mjs');
const child = spawn(process.execPath, [server], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, LAZYDEV_SEARCH_TEST_UNAVAILABLE: '1', LAZYDEV_SEARCH_USER_AGENT: 'lazydev/test' },
});
let buf = '';
const lines = [];
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
    if (line.trim()) lines.push(JSON.parse(line));
  }
});
const waitFor = async (id) => {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const match = lines.find((item) => item.id === id);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`MCP response ${id} not received`);
};
try {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
  const init = await waitFor(1);
  assert.equal(init.result.serverInfo.name, 'lazydev-search');

  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
  const list = await waitFor(2);
  assert.equal(list.result.tools[0].name, 'search_web');
  assert.equal(list.result.tools[0].inputSchema.additionalProperties, false);

  child.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'search_web', arguments: { query: 'anime watch html template embed video player' } },
  }) + '\n');
  const call = await waitFor(3);
  assert.ok(!call.error, 'transport/search outage must not become an MCP protocol error');
  assert.equal(call.result.structuredContent.status, 'unavailable');
  assert.equal(call.result.structuredContent.retryable, true);
  assert.match(call.result.content[0].text, /temporarily unavailable/i);

  console.log('PASS: LazyDev search MCP degrades without exposing transient network failure as a protocol error');
} finally {
  child.kill('SIGTERM');
}
