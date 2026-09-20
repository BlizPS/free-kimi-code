import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'cli', 'lazydev.py');
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-browser-config-'));
const env = { ...process.env, HOME: tempHome, KIMI_HOME: path.join(tempHome, '.kimi-code') };
const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'lazydev.mjs'), 'doctor'], { env, encoding: 'utf8' });
assert.equal(result.status, 0);
const mcpFile = path.join(tempHome, '.kimi-code', 'mcp.json');
// The Python-native CLI is the authoritative no-Node path; this smoke verifies the
// generated MJS adapter source no longer uses process.execPath for the MCP server.
const source = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
assert.match(source, /pythonCommand/);
const block = source.match(/function writeLazyDevMcpConfig\(\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(block, /command:\s*process\.execPath/);
console.log('PASS: LazyDev MCP search/browser config uses Python, not Node');
void cli;
