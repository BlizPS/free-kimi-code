import http from 'node:http';
import assert from 'node:assert/strict';
import { createAntigravityProxy } from '../runtime/antigravity-proxy.mjs';

let seen = [];
const upstream = http.createServer((req, res) => {
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', c => raw += c);
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    seen.push(body);
    res.writeHead(200, {'content-type':'application/json'});
    if (!body.previous_interaction_id) {
      res.end(JSON.stringify({
        id: 'int_1',
        environment_id: 'env_1',
        status: 'requires_action',
        steps: [{type:'function_call', id:'fc_1', name:'external_run_command', arguments:{command:'git status'}}]
      }));
    } else {
      res.end(JSON.stringify({
        id: 'int_2',
        environment_id: 'env_1',
        status: 'completed',
        output_text: 'Done — the tool result was received.'
      }));
    }
  });
});
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const port = upstream.address().port;
const proxy = await createAntigravityProxy({
  apiKey: 'test-key',
  model: 'antigravity-preview-05-2026',
  endpoint: `http://127.0.0.1:${port}/v1beta/interactions`,
});

async function call(body) {
  const r = await fetch(`http://127.0.0.1:${proxy.port}/v1/chat/completions`, {
    method:'POST', headers:{authorization:`Bearer ${proxy.token}`, 'content-type':'application/json'}, body:JSON.stringify(body)
  });
  return {status:r.status, body:await r.json()};
}

const first = await call({
  model:'antigravity-preview-05-2026',
  stream:false,
  messages:[{role:'user', content:'Check the repository status.'}],
  tools:[{type:'function', function:{name:'run_command', description:'Run a command', parameters:{type:'object',properties:{command:{type:'string'}}}}}]
});
assert.equal(first.status, 200);
assert.equal(first.body.choices[0].finish_reason, 'tool_calls');
assert.equal(first.body.choices[0].message.tool_calls[0].function.name, 'run_command');
assert.equal(seen[0].agent, 'antigravity-preview-05-2026');
assert.equal(seen[0].environment, 'remote');
assert.ok(seen[0].tools.some((t) => t.type === 'function' && t.name === 'external_run_command'));

const second = await call({
  model:'antigravity-preview-05-2026',
  messages:[
    {role:'user', content:'Check the repository status.'},
    {role:'assistant', content:null, tool_calls:[{id:'fc_1', type:'function', function:{name:'run_command', arguments:'{"command":"git status"}'}}]},
    {role:'tool', tool_call_id:'fc_1', name:'run_command', content:'On branch main\nworking tree clean'},
  ],
});
assert.equal(second.status, 200);
assert.equal(second.body.choices[0].message.content, 'Done — the tool result was received.');
assert.equal(seen[1].previous_interaction_id, 'int_1');
assert.equal(seen[1].environment, 'env_1');
assert.equal(seen[1].input[0].type, 'function_result');
assert.equal(seen[1].input[0].name, 'external_run_command');
assert.equal(seen[1].input[0].call_id, 'fc_1');

proxy.server.close();
upstream.close();
console.log('PASS: Antigravity proxy stateful function-call round trip');
