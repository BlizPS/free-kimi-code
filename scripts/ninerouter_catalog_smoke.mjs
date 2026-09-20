#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const cliSource = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
assert.match(source, /id: 'ninerouter'/);
assert.match(source, /NINEROUTER_API_KEY/);
assert.match(source, /function normalizeNineRouterBaseUrl/);
assert.match(source, /function nineRouterModelsUrl/);
assert.match(source, /function nineRouterChatUrl/);
assert.match(source, /provider\.id === 'ninerouter'/);
assert.match(source, /catalog stays empty/i);
assert.match(cliSource, /"id": "ninerouter"/);
assert.match(cliSource, /NINEROUTER_API_KEY/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lazydev-9router-'));
const xdg = path.join(temp, 'xdg');
const fakeHome = path.join(temp, 'home');
const serverFile = path.join(temp, 'server.mjs');
fs.mkdirSync(xdg, { recursive: true });
fs.mkdirSync(fakeHome, { recursive: true });
fs.writeFileSync(serverFile, `import http from 'node:http';\nconst port = Number(process.argv[2]);\nconst empty = process.env.EMPTY_CATALOG === '1';\nconst server = http.createServer((req,res)=>{\n  if (req.url === '/v1/models' && req.headers.authorization === 'Bearer test-key') {\n    const data = empty ? {object:'list',data:[]} : {object:'list',data:[{id:'cx/test-alpha',object:'model',owned_by:'test'},{id:'cc/test-beta',object:'model',owned_by:'test'}]};\n    res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify(data)); return;\n  }\n  res.writeHead(401, {'content-type':'application/json'}); res.end(JSON.stringify({error:{message:'unauthorized'}}));\n});\nserver.listen(port,'127.0.0.1',()=>process.stdout.write('READY\\n'));\n`);

async function startServer(empty) {
  const serverPort = 39128 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [serverFile, String(serverPort)], {
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, EMPTY_CATALOG: empty ? '1' : '0' },
  });
  await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('9Router smoke server did not start')), 5000);
    child.stdout.on('data', chunk => { out += chunk.toString(); if (out.includes('READY')) { clearTimeout(timer); resolve(); } });
    child.once('error', reject);
    child.once('exit', code => code !== 0 && reject(new Error(`smoke server exited with ${code}`)));
  });
  return { child, port: serverPort };
}

const py = path.join(root, 'cli', 'lazydev.py');
const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, XDG_CONFIG_HOME: xdg };

const liveServer = await startServer(false);
const liveBase = `http://127.0.0.1:${liveServer.port}/v1`;
const firstRun = spawnSync('python3', [py, 'setup'], {
  env,
  input: `11\n${liveBase}\ntest-key\n\n`,
  encoding: 'utf8', timeout: 20000,
});
liveServer.child.kill('SIGTERM');
assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);
const configPath = path.join(xdg, 'lazydev', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
assert.equal(config.activeProvider, 'ninerouter');
assert.equal(config.providers.ninerouter.model, 'cc/test-beta');
assert.equal(config.providers.ninerouter.baseUrl, liveBase);
assert.equal(config.providers.ninerouter.apiKey, 'test-key');

const emptyServer = await startServer(true);
const emptyBase = `http://127.0.0.1:${emptyServer.port}/v1`;
const secondRun = spawnSync('python3', [py, 'setup'], {
  env,
  input: `11\n${emptyBase}\ny\n`,
  encoding: 'utf8', timeout: 20000,
});
emptyServer.child.kill('SIGTERM');
assert.equal(secondRun.status, 1, secondRun.stderr || secondRun.stdout);
assert.match(secondRun.stdout, /No compatible models returned/);
const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
assert.equal(after.activeProvider, 'ninerouter');
assert.equal(after.providers.ninerouter.model, 'cc/test-beta');
assert.equal(after.providers.ninerouter.apiKey, 'test-key');

console.log('9Router catalog smoke: PASS');
