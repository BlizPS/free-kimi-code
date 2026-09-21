#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const py = path.join(root, 'cli', 'lazydev.py');
const js = path.join(root, 'scripts', 'lazydev.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-9router-thinking-'));
const home = path.join(temp, 'home');
const xdg = path.join(temp, 'xdg');
const bin = path.join(home, '.local', 'bin');
const fakeKimi = path.join(bin, 'kimi');
const captured = path.join(temp, 'config.toml');
const capturedModelEnv = path.join(temp, 'model-env.txt');
fs.mkdirSync(bin, { recursive: true });
fs.mkdirSync(xdg, { recursive: true });

const pythonProbe = spawnSync(
  process.platform === 'win32' ? 'where.exe' : 'which',
  ['python3'],
  { encoding: 'utf8' }
);
const python3 = (pythonProbe.stdout || '').split(/\r?\n/).find(Boolean);
if (!python3) throw new Error('python3 is required for 9Router thinking smoke');

fs.writeFileSync(fakeKimi, `#!/bin/sh
node - <<'NODE'
const fs = require('fs');
fs.copyFileSync(process.env.KIMI_CODE_HOME + '/config.toml', ${JSON.stringify(captured)});
fs.writeFileSync(${JSON.stringify(capturedModelEnv)}, process.env.KIMI_MODEL_NAME || '');
NODE
exit 0
`);
fs.chmodSync(fakeKimi, 0o755);

const nodeShim = path.join(bin, process.platform === 'win32' ? 'node.exe' : 'node');
const pythonShim = path.join(bin, process.platform === 'win32' ? 'python3.exe' : 'python3');
fs.symlinkSync(process.execPath, nodeShim);
fs.symlinkSync(python3, pythonShim);

const server = path.join(temp, 'server.mjs');
fs.writeFileSync(server, `import http from 'node:http';\nconst port = Number(process.argv[2]);\nconst server = http.createServer((req,res)=>{\n  if (req.url === '/v1/models' && req.headers.authorization === 'Bearer key') {\n    res.writeHead(200, {'content-type':'application/json'});\n    res.end(JSON.stringify({object:'list',data:[\n      {id:'ag/claude-opus-4-6-thinking',object:'model',capabilities:{reasoning:true,thinkingCanDisable:true,tools:true,contextWindow:200000,maxOutput:8192}},\n      {id:'always-thinking-test',object:'model',capabilities:{reasoning:true,thinkingCanDisable:false,tools:true,contextWindow:200000,maxOutput:8192}}\n    ]}));\n    return;\n  }\n  res.writeHead(401, {'content-type':'application/json'});\n  res.end(JSON.stringify({error:{message:'unauthorized'}}));\n});\nserver.listen(port,'127.0.0.1',()=>process.stdout.write('READY\\n'));\n`);

function startServer() {
  const port = 39200 + Math.floor(Math.random() * 500);
  const proc = spawn(process.execPath, [server, String(port)], { stdout: 'pipe', stderr: 'pipe' });
  return { proc, port };
}

const { proc, port } = startServer();
await new Promise((resolve, reject) => {
  let out = '';
  const timer = setTimeout(() => reject(new Error('9Router thinking smoke server did not start')), 5000);
  proc.stdout.on('data', (chunk) => { out += chunk.toString(); if (out.includes('READY')) { clearTimeout(timer); resolve(); } });
  proc.once('error', reject);
});

const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, PATH: `${bin}` };
const base = `http://127.0.0.1:${port}/v1`;
const setup = spawnSync('python3', [py, 'setup'], { env, input: `11\n${base}\nkey\n1\n`, encoding: 'utf8', timeout: 20000 });
assert.equal(setup.status, 0, setup.stderr || setup.stdout);

const configPath = path.join(xdg, 'lazydev', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
assert.equal(config.providers.ninerouter.model, 'ag/claude-opus-4-6-thinking');
assert.equal(config.providers.ninerouter.modelInfo.offEffort, 'none');

let chat = spawnSync(process.execPath, [js, 'chat'], { env, encoding: 'utf8', timeout: 20000 });
assert.equal(chat.status, 0, chat.stderr || chat.stdout);
let generated = fs.readFileSync(captured, 'utf8');
assert.match(generated, /\[models\."lazydev\/ag\/claude-opus-4-6-thinking"\]/);
assert.match(generated, /off_effort = "none"/);
assert.match(fs.readFileSync(capturedModelEnv, 'utf8'), /^ag\/claude-opus-4-6-thinking$/);

// Existing saved metadata with no offEffort must self-heal too.
config.providers.ninerouter.model = 'always-thinking-test';
config.providers.ninerouter.modelInfo = { id: 'always-thinking-test', reasoning: true, thinkingCanDisable: false, contextLimit: 200000, outputLimit: 8192, toolUse: true };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
chat = spawnSync(process.execPath, [js, 'chat'], { env, encoding: 'utf8', timeout: 20000 });
assert.equal(chat.status, 0, chat.stderr || chat.stdout);
generated = fs.readFileSync(captured, 'utf8');
assert.match(generated, /default_model = \"lazydev\/always-thinking-test\"/);
assert.doesNotMatch(generated, /off_effort =/);

proc.kill('SIGTERM');
console.log('9Router thinking compatibility smoke: PASS');
