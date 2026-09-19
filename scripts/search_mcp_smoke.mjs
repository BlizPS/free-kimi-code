import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const child = spawn(process.execPath, [path.join(root, 'runtime', 'lazydev-web-search.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
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
  const deadline = Date.now() + 3000;
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
  console.log('PASS: LazyDev web-search MCP server exposes a valid search_web tool');
} finally {
  child.kill('SIGTERM');
}
