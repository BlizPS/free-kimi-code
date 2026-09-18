import http from 'node:http';
import assert from 'node:assert/strict';
import { createAntigravityProxy } from '../runtime/antigravity-proxy.mjs';

let seen = [];
let retryAttempts = 0;
const upstream = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/v1beta/interactions/int_3') {
    res.writeHead(200, {'content-type':'application/json'});
    return res.end(JSON.stringify({
      id: 'int_3',
      environment_id: 'env_1',
      status: 'completed',
      steps: [{type:'model_output', content:[{type:'text', text:'Recovered from interaction retrieval.'}]}]
    }));
  }
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', c => raw += c);
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    body.__revision_header = req.headers['api-revision'];
    seen.push(body);
    if (String(body.input || '') === 'retry-me' && retryAttempts++ === 0) {
      res.writeHead(500, {'content-type':'application/json'});
      return res.end(JSON.stringify({error:{code:'api_error',message:'Internal error encountered.'}}));
    }
    res.writeHead(200, {'content-type':'application/json'});
    if (String(body.input || '') === 'retry-me') {
      return res.end(JSON.stringify({
        id: 'int_retry', environment_id: 'env_retry', status: 'completed',
        steps: [{type:'model_output', content:[{type:'text', text:'Retry succeeded.'}]}]
      }));
    }
    if (!body.previous_interaction_id) {
      if (String(body.input || '') === 'Create a standalone artifact.') {
        res.end(JSON.stringify({
          id: 'int_artifact_1',
          environment_id: 'env_artifact',
          status: 'requires_action',
          steps: [{type:'function_call', id:'fc_artifact_1', name:'lazydev_write', arguments:{file_path:'/storage/emulated/0/lazydevfile/descriptive-artifact.html', content:'<!doctype html><title>Artifact</title>', toolAction:'write', toolSummary:'Create the requested file'}}]
        }));
      } else {
        res.end(JSON.stringify({
          id: 'int_1',
          environment_id: 'env_1',
          status: 'requires_action',
          steps: [{type:'function_call', id:'fc_1', name:'lazydev_bash', arguments:{command:'git status', toolAction:'run', toolSummary:'Inspect the repository'}}]
        }));
      }
    } else if (body.previous_interaction_id === 'int_1') {
      res.end(JSON.stringify({
        id: 'int_2',
        environment_id: 'env_1',
        status: 'completed',
        steps: [{type:'model_output', content:[{type:'text', text:'Done — the tool result was received from the model_output step.'}]}]
      }));
    } else {
      res.end(JSON.stringify({
        id: 'int_3',
        environment_id: 'env_1',
        status: 'completed',
        steps: [{type:'function_call', id:'builtin_1', name:'code_execution', arguments:{command:'echo ok'}}]
      }));
    }
  });
});
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const port = upstream.address().port;
const proxy = await createAntigravityProxy({
  apiKey: 'test-key',
  model: 'antigravity-preview-09-2026',
  endpoint: `http://127.0.0.1:${port}/v1beta/interactions`,
});

async function call(body) {
  const r = await fetch(`http://127.0.0.1:${proxy.port}/v1/chat/completions`, {
    method:'POST', headers:{authorization:`Bearer ${proxy.token}`, 'content-type':'application/json'}, body:JSON.stringify(body)
  });
  return {status:r.status, body:await r.json()};
}

const first = await call({
  model:'antigravity-preview-09-2026',
  stream:false,
  messages:[{role:'user', content:'Check the repository status.'}],
  tools:[{type:'function', function:{name:'Bash', description:'Run a command', parameters:{type:'object',additionalProperties:false,properties:{command:{type:'string'}}}}}]
});
assert.equal(first.status, 200);
assert.equal(first.body.choices[0].finish_reason, 'tool_calls');
assert.equal(first.body.choices[0].message.tool_calls[0].function.name, 'Bash');
assert.deepEqual(JSON.parse(first.body.choices[0].message.tool_calls[0].function.arguments), {command:'git status'});
assert.equal(JSON.parse(first.body.choices[0].message.tool_calls[0].function.arguments).toolAction, undefined);
assert.equal(JSON.parse(first.body.choices[0].message.tool_calls[0].function.arguments).toolSummary, undefined);
assert.equal(seen[0].agent, 'antigravity-preview-09-2026');
assert.equal(seen[0].environment, 'remote');
assert.match(String(seen[0].system_instruction || ''), /reasoning engine behind a local coding CLI/i);
assert.match(String(seen[0].system_instruction || ''), /do not perform unrelated reconnaissance/i);
assert.match(String(seen[0].system_instruction || ''), /tool self-test/i);
assert.match(String(seen[0].system_instruction || ''), /descriptive filename/i);
assert.match(String(seen[0].system_instruction || ''), /do not default to index\.\*/i);
assert.equal(seen[0].input, 'Check the repository status.');
assert.doesNotMatch(String(seen[0].input || ''), /LazyDev Intelligence Alias System|Keep the task boundary explicit|Execution order/i);

assert.ok(Array.isArray(seen[0].tools));
assert.ok(seen[0].tools.some((t) => t.type === 'function' && t.name === 'lazydev_bash'));
assert.equal(seen[0].agent_config.type, 'antigravity');
assert.equal(seen[0].agent_config.max_total_tokens, 50000);
assert.equal(seen[0].tools?.find((t) => t.name === 'lazydev_bash')?.type, 'function');
assert.equal(seen[0].tools?.length, 1);
assert.equal(seen[0].tools?.some((t) => t.name === 'lazydev_todolist'), false);
assert.equal(seen[0].tools?.some((t) => t.type === 'code_execution'), false);
assert.equal(seen[0].tools?.some((t) => t.type === 'google_search'), false);
assert.equal(seen[0].tools?.some((t) => t.type === 'url_context'), false);
assert.equal(seen[0].__revision_header, undefined);

// Antigravity Interactions requires environment on every interaction.
assert.ok(seen[0].environment);

const second = await call({
  model:'antigravity-preview-09-2026',
  messages:[
    {role:'user', content:'Check the repository status.'},
    {role:'assistant', content:null, tool_calls:[{id:'fc_1', type:'function', function:{name:'Bash', arguments:'{"command":"git status"}'}}]},
    {role:'tool', tool_call_id:'fc_1', name:'Bash', content:'On branch main\nworking tree clean'},
  ],
});
assert.equal(second.status, 200);
assert.equal(second.body.choices[0].message.content, 'Done — the tool result was received from the model_output step.');
assert.equal(seen[1].previous_interaction_id, 'int_1');
assert.equal(seen[1].environment, 'env_1');
assert.equal(seen[1].tools?.length, 1);
assert.equal(seen[1].tools?.[0]?.name, 'lazydev_bash');
assert.match(String(seen[1].system_instruction || ''), /tool self-test/i);
assert.equal(seen[1].input[0].type, 'function_result');
assert.equal(seen[1].input[0].name, 'lazydev_bash');
assert.equal(seen[1].input[0].call_id, 'fc_1');
assert.deepEqual(seen[1].input[0].result, [{type:'text', text:'On branch main\nworking tree clean'}]);

const third = await call({
  model:'antigravity-preview-09-2026',
  messages:[
    {role:'assistant', content:'Prior tool output: /root/index.html'},
    {role:'user', content:'Give me the final result.'},
  ],
});
assert.equal(third.status, 200);
assert.equal(seen[2].previous_interaction_id, undefined);
assert.equal(seen[2].environment, 'remote');
assert.equal(seen[2].tools?.length, 0);
assert.equal(seen[2].input, 'Give me the final result.');
assert.doesNotMatch(String(seen[2].input), /Prior tool output|\/root\/index\.html/i);

const artifactProxy = await createAntigravityProxy({
  apiKey: 'test-key',
  model: 'antigravity-preview-09-2026',
  endpoint: `http://127.0.0.1:${port}/v1beta/interactions`,
});
async function callArtifact(body) {
  const r = await fetch(`http://127.0.0.1:${artifactProxy.port}/v1/chat/completions`, {
    method:'POST', headers:{authorization:`Bearer ${artifactProxy.token}`, 'content-type':'application/json'}, body:JSON.stringify(body)
  });
  return {status:r.status, body:await r.json()};
}

const artifactTools = [
  {type:'function', function:{name:'Read', description:'Read a file', parameters:{type:'object', additionalProperties:false, properties:{file_path:{type:'string'}}}}},
  {type:'function', function:{name:'Write', description:'Write a file', parameters:{type:'object', additionalProperties:false, properties:{file_path:{type:'string'}, content:{type:'string'}}, required:['file_path','content']}}},
  {type:'function', function:{name:'Edit', description:'Edit a file', parameters:{type:'object', additionalProperties:false, properties:{file_path:{type:'string'}, old_string:{type:'string'}, new_string:{type:'string'}}}}},
  {type:'function', function:{name:'Glob', description:'Find files', parameters:{type:'object', additionalProperties:false, properties:{pattern:{type:'string'}}}}},
  {type:'function', function:{name:'Bash', description:'Run command', parameters:{type:'object', additionalProperties:false, properties:{command:{type:'string'}}}}},
];
const artifactFirst = await callArtifact({
  model:'antigravity-preview-09-2026',
  messages:[
    {role:'system', content:'PRIVATE FILE CONTENT THAT MUST NOT REACH THE REMOTE MODEL'},
    {role:'assistant', content:'Prior unrelated tool output: /root/index.html'},
    {role:'user', content:'Create a standalone artifact.'},
  ],
  tools:artifactTools,
});
assert.equal(artifactFirst.status, 200);
assert.equal(artifactFirst.body.choices[0].finish_reason, 'tool_calls');
assert.equal(artifactFirst.body.choices[0].message.tool_calls[0].function.name, 'Write');
assert.deepEqual(JSON.parse(artifactFirst.body.choices[0].message.tool_calls[0].function.arguments), {
  file_path:'/storage/emulated/0/lazydevfile/descriptive-artifact.html',
  content:'<!doctype html><title>Artifact</title>',
});
const artifactSeen = seen.find((item) => item.input === 'Create a standalone artifact.');
assert.ok(artifactSeen);
assert.equal(artifactSeen.tools.length, 1);
assert.equal(artifactSeen.tools[0].name, 'lazydev_write');
assert.equal(artifactSeen.input, 'Create a standalone artifact.');
assert.doesNotMatch(String(artifactSeen.input), /PRIVATE FILE CONTENT|Prior unrelated tool output|\/root\/index\.html/i);

const artifactSecond = await callArtifact({
  model:'antigravity-preview-09-2026',
  messages:[
    {role:'user', content:'Create a standalone artifact.'},
    {role:'assistant', content:null, tool_calls:[{id:'fc_artifact_1', type:'function', function:{name:'Write', arguments:JSON.stringify({file_path:'/storage/emulated/0/lazydevfile/descriptive-artifact.html', content:'<!doctype html><title>Artifact</title>'})}}]},
    {role:'tool', tool_call_id:'fc_artifact_1', name:'Write', content:'Wrote /storage/emulated/0/lazydevfile/descriptive-artifact.html'},
  ],
  tools:artifactTools,
});
assert.equal(artifactSecond.status, 200);
assert.equal(seen.at(-1).environment, 'env_artifact');
assert.deepEqual(seen.at(-1).tools.map((tool) => tool.name).sort(), ['lazydev_bash','lazydev_edit','lazydev_read','lazydev_write']);

const retry = await call({
  model:'antigravity-preview-09-2026',
  messages:[{role:'user', content:'retry-me'}],
});
assert.equal(retry.status, 200);
assert.equal(retry.body.choices[0].message.content, 'Retry succeeded.');
assert.equal(retryAttempts, 2);

// A fresh proxy with no local tools must explicitly send tools: [] so the
// Antigravity defaults (code_execution/google_search/url_context) are not
// silently re-enabled.
const noToolsProxy = await createAntigravityProxy({
  apiKey: 'test-key',
  model: 'antigravity-preview-09-2026',
  endpoint: `http://127.0.0.1:${port}/v1beta/interactions`,
});
const noTools = await fetch(`http://127.0.0.1:${noToolsProxy.port}/v1/chat/completions`, {
  method:'POST', headers:{authorization:`Bearer ${noToolsProxy.token}`, 'content-type':'application/json'},
  body:JSON.stringify({ model:'antigravity-preview-09-2026', messages:[{role:'user', content:'Hello'}] })
});
assert.equal(noTools.status, 200);
const noToolsSeen = seen.at(-1);
assert.deepEqual(noToolsSeen.tools, []);
assert.equal(noToolsSeen.environment, 'remote');
artifactProxy.server.close();
noToolsProxy.server.close();
proxy.server.close();
upstream.close();
console.log('PASS: Antigravity proxy stateful function-call round trip');
