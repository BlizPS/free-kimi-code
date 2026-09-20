import http from 'node:http';
import crypto from 'node:crypto';

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'connection': 'close' });
  res.end(body);
}
function text(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map(part => typeof part === 'string' ? part : part && typeof part === 'object' ? String(part.text || '') : '').filter(Boolean).join('\n');
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw=''; req.setEncoding('utf8');
    req.on('data', c => { raw += c; if (raw.length > 8*1024*1024) reject(new Error('Request body too large.')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function geminiToChat(body, model) {
  const messages=[];
  const system=body.systemInstruction || body.system_instruction;
  if (system) { const value=text(system.parts || system); if (value) messages.push({ role:'system', content:value }); }
  for (const item of Array.isArray(body.contents) ? body.contents : []) {
    if (!item || typeof item !== 'object') continue;
    const role = ['model','assistant'].includes(item.role) ? 'assistant' : 'user';
    const parts = Array.isArray(item.parts) ? item.parts : [];
    const texts=[]; const toolCalls=[];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') texts.push(part.text);
      const inline = part.inlineData || part.inline_data;
      if (inline?.data && inline?.mimeType) texts.push(`[Inline image: data:${inline.mimeType};base64,${inline.data}]`);
      if (part.functionCall?.name) toolCalls.push({ id: crypto.randomUUID(), type:'function', function:{ name:String(part.functionCall.name), arguments:JSON.stringify(part.functionCall.args || {}) } });
      const fr = part.functionResponse;
      if (fr?.name) messages.push({ role:'tool', tool_call_id:String(fr.id || fr.callId || fr.call_id || fr.name), name:String(fr.name), content:JSON.stringify(fr.response ?? {}) });
    }
    const msg={ role, content:texts.join('\n') || '' };
    if (toolCalls.length) msg.tool_calls=toolCalls;
    if (msg.content || toolCalls.length) messages.push(msg);
  }
  const out={ model, messages, stream:false };
  const gen = body.generationConfig && typeof body.generationConfig === 'object' ? body.generationConfig : {};
  if (gen.maxOutputTokens != null) out.max_tokens=gen.maxOutputTokens;
  if (gen.temperature != null) out.temperature=gen.temperature;
  if (gen.topP != null) out.top_p=gen.topP;
  if (Array.isArray(gen.stopSequences)) out.stop=gen.stopSequences;
  const tools=[];
  for (const group of Array.isArray(body.tools) ? body.tools : []) {
    const decls=group?.functionDeclarations || group?.function_declarations;
    for (const decl of Array.isArray(decls) ? decls : []) if (decl?.name) tools.push({ type:'function', function:{ name:String(decl.name), description:String(decl.description || ''), parameters:decl.parameters || {type:'object',properties:{}} } });
  }
  if (tools.length) { out.tools=tools; out.tool_choice='auto'; }
  return out;
}
function chatToGemini(completion, model) {
  const choice=Array.isArray(completion?.choices) ? completion.choices[0] || {} : {};
  const msg=choice.message || {};
  const parts=[];
  if (msg.content) parts.push({text:String(msg.content)});
  for (const call of Array.isArray(msg.tool_calls) ? msg.tool_calls : []) {
    const fn=call?.function || {};
    if (!fn.name) continue;
    let args={}; try { args=JSON.parse(fn.arguments || '{}'); } catch {}
    parts.push({functionCall:{name:String(fn.name),args}});
  }
  const usage=completion?.usage || {};
  return { candidates:[{content:{role:'model',parts}, finishReason:String(choice.finish_reason || 'STOP').toUpperCase() === 'TOOL_CALLS' ? 'STOP' : String(choice.finish_reason || 'STOP').toUpperCase()}], modelVersion:model, usageMetadata:{promptTokenCount:Number(usage.prompt_tokens)||0,candidatesTokenCount:Number(usage.completion_tokens)||0,totalTokenCount:Number(usage.total_tokens)||0} };
}

export async function createAntigravityProxy({ upstreamUrl, upstreamToken, model, exposedModel='gemini-3.8-flash-medium' }) {
  const token = crypto.randomBytes(24).toString('hex');
  const selectedModel=String(model || exposedModel);
  const upstream=String(upstreamUrl || '').replace(/\/$/,'');
  const server=http.createServer(async (req,res) => {
    const auth=req.headers.authorization === `Bearer ${token}` || req.headers['x-goog-api-key'] === token;
    if (!auth) return json(res,401,{error:{message:'Unauthorized'}});
    const pathname=new URL(req.url || '/', 'http://127.0.0.1').pathname;
    try {
      if (req.method==='GET' && pathname==='/v1beta/models') return json(res,200,{models:[{name:`models/${exposedModel}`,displayName:`LazyDev · ${selectedModel}`,supportedGenerationMethods:['generateContent','streamGenerateContent']}]});
      if (req.method!=='POST') return json(res,404,{error:{message:'Not found'}});
      if (!/^\/v1beta\/models\/[^/]+:(generateContent|streamGenerateContent)$/.test(pathname)) return json(res,404,{error:{message:'Not found'}});
      const body=await readJson(req);
      const chat=geminiToChat(body,selectedModel);
      const response=await fetch(`${upstream}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${upstreamToken}`},body:JSON.stringify(chat)});
      const raw=await response.text();
      if (!response.ok) { let error; try { error=JSON.parse(raw); } catch { error={error:{message:raw || `HTTP ${response.status}`}}; } return json(res,response.status,error); }
      const completion=JSON.parse(raw); const result=chatToGemini(completion,selectedModel);
      if (pathname.endsWith(':streamGenerateContent')) {
        const payload=`data: ${JSON.stringify(result)}\n\n`;
        res.writeHead(200,{ 'content-type':'text/event-stream','content-length':Buffer.byteLength(payload)+14,'connection':'close' });
        res.end(payload+'data: [DONE]\n\n');
        return;
      }
      return json(res,200,result);
    } catch (error) { return json(res,502,{error:{message:`Antigravity proxy failed: ${error.message}`}}); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return { server, token, port:server.address().port, model:selectedModel, exposedModel };
}
