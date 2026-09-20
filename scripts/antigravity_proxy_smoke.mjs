import http from 'node:http';
import assert from 'node:assert/strict';
import { createAntigravityProxy } from '../runtime/antigravity-proxy.mjs';

const seen=[];
const upstream=http.createServer((req,res)=>{
  let raw=''; req.setEncoding('utf8'); req.on('data',c=>raw+=c); req.on('end',()=>{
    const body=JSON.parse(raw||'{}'); seen.push(body);
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'chatcmpl_test',choices:[{index:0,message:{role:'assistant',content:'Ready from LazyDev.',tool_calls:[]},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:7,total_tokens:19}}));
  });
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
const proxy=await createAntigravityProxy({upstreamUrl:`http://127.0.0.1:${upstream.address().port}/v1`,upstreamToken:'upstream-key',model:'nvidia/test-model'});
const list=await fetch(`http://127.0.0.1:${proxy.port}/v1beta/models`,{headers:{'x-goog-api-key':proxy.token}});
assert.equal(list.status,200); const models=await list.json(); assert.equal(models.models[0].name,'models/gemini-3.8-flash-medium');
const r=await fetch(`http://127.0.0.1:${proxy.port}/v1beta/models/gemini-3.8-flash-medium:generateContent`,{method:'POST',headers:{'x-goog-api-key':proxy.token,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'hello'}]}],tools:[{functionDeclarations:[{name:'lazydev_search',description:'Search',parameters:{type:'object',properties:{q:{type:'string'}}}}]}]})});
assert.equal(r.status,200); const payload=await r.json(); assert.equal(payload.candidates[0].content.parts[0].text,'Ready from LazyDev.');
assert.equal(seen[0].model,'nvidia/test-model'); assert.equal(seen[0].tools[0].function.name,'lazydev_search');
const sr=await fetch(`http://127.0.0.1:${proxy.port}/v1beta/models/gemini-3.8-flash-medium:streamGenerateContent`,{method:'POST',headers:{'x-goog-api-key':proxy.token,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:'stream'}]}]})});
assert.equal(sr.status,200); const streamText=await sr.text(); assert.equal(streamText.includes('[DONE]'),false,streamText); assert.match(streamText,/^data: \{[\s\S]+\n\n$/);
proxy.server.close(); upstream.close();
console.log('PASS: Antigravity Gemini-compatible bridge routes setup model + tools + EOF-terminated SSE');
