import http from 'node:http';
import crypto from 'node:crypto';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_AGENT = 'antigravity-preview-09-2026';
const BUILTIN_TOOLS = [
  { type: 'code_execution' },
  { type: 'google_search' },
  { type: 'url_context' },
];

function normalizeText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((part) => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') return '';
    if (part.type === 'text' && typeof part.text === 'string') return part.text;
    if (part.type === 'input_text' && typeof part.text === 'string') return part.text;
    return '';
  }).filter(Boolean).join('\n');
}

function toolDeclarations(openAITools = []) {
  const mappings = new Map();
  const tools = [];
  for (const item of openAITools) {
    const fn = item?.function;
    if (item?.type !== 'function' || !fn?.name) continue;
    const original = String(fn.name);
    const external = `external_${original}`;
    mappings.set(original, external);
    tools.push({
      type: 'function',
      name: external,
      description: String(fn.description || ''),
      parameters: fn.parameters && typeof fn.parameters === 'object' ? fn.parameters : { type: 'object', properties: {} },
    });
  }
  return { tools, mappings };
}

function transcriptInput(messages = []) {
  return messages.map((m) => {
    const role = String(m?.role || 'unknown');
    const content = normalizeText(m?.content);
    if (!content) return '';
    return `${role.toUpperCase()}:\n${content}`;
  }).filter(Boolean).join('\n\n');
}

function recentUserInput(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') {
      const text = normalizeText(m.content);
      if (text) return text;
    }
  }
  return '';
}

function toolResultInputs(messages, mappings) {
  const results = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'tool') break;
    const originalId = String(m.tool_call_id || '');
    const name = String(m.name || '') || null;
    const mappedName = name ? mappings.get(name) || name : null;
    const result = normalizeText(m.content);
    results.unshift({
      type: 'function_result',
      name: mappedName || 'external_tool',
      call_id: originalId || crypto.randomUUID(),
      result: result || '',
    });
  }
  return results;
}

async function postInteraction(endpoint, apiKey, payload, timeout = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-goog-api-key': apiKey,
              },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: { message: text } }; }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
      const error = new Error(String(message));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Antigravity request timed out after ${timeout}ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getInteraction(endpoint, apiKey, interactionId, timeout = 30000) {
  const base = new URL(endpoint);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/${encodeURIComponent(interactionId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { accept: 'application/json', 'x-goog-api-key': apiKey };
    const revision = String(process.env.LAZYDEV_ANTIGRAVITY_API_REVISION || '').trim();
    if (revision) headers['Api-Revision'] = revision;
    const response = await fetch(base, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: { message: text } }; }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
      const error = new Error(String(message));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Antigravity result retrieval timed out after ${timeout}ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function blockText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string') return value.text;
  if (typeof value.output_text === 'string') return value.output_text;
  if (Array.isArray(value.content)) return value.content.map(blockText).filter(Boolean).join('\n');
  if (Array.isArray(value.parts)) return value.parts.map(blockText).filter(Boolean).join('\n');
  return '';
}

function functionCallFromStep(step, mappings) {
  if (!step || typeof step !== 'object') return null;
  const type = String(step.type || '');
  const isCall = type === 'function_call' || type === 'tool_call';
  if (!isCall || !step.name) return null;
  const upstream = String(step.name);
  const original = [...mappings.entries()].find(([, mapped]) => mapped === upstream)?.[0];
  if (!original) return null;
  const args = step.arguments && typeof step.arguments === 'object'
    ? step.arguments
    : typeof step.arguments === 'string'
      ? (() => { try { return JSON.parse(step.arguments); } catch { return {}; } })()
      : {};
  return {
    id: String(step.id || step.call_id || crypto.randomUUID()),
    type: 'function',
    function: {
      name: original,
      arguments: JSON.stringify(args),
    },
  };
}

function outputSteps(data, mappings) {
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const calls = [];
  const texts = [];

  for (const step of steps) {
    const call = functionCallFromStep(step, mappings);
    if (call) { calls.push(call); continue; }

    if (step?.type === 'model_output') {
      const content = Array.isArray(step.content) ? step.content : [step.content];
      for (const block of content) {
        const blockCall = functionCallFromStep(block, mappings);
        if (blockCall) calls.push(blockCall);
        else {
          const text = blockText(block);
          if (text) texts.push(text);
        }
      }
      continue;
    }

    const text = blockText(step);
    if (text) texts.push(text);
  }

  if (typeof data?.output_text === 'string' && data.output_text.trim()) texts.unshift(data.output_text);
  if (typeof data?.output === 'string' && data.output.trim()) texts.unshift(data.output);
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      const call = functionCallFromStep(item, mappings);
      if (call) calls.push(call);
      else {
        const text = blockText(item);
        if (text) texts.push(text);
      }
    }
  }

  const uniqueTexts = [];
  const seen = new Set();
  for (const text of texts) {
    const normalized = String(text).trim();
    if (normalized && !seen.has(normalized)) { seen.add(normalized); uniqueTexts.push(normalized); }
  }
  const uniqueCalls = [];
  const callKeys = new Set();
  for (const call of calls) {
    const key = `${call.id}:${call.function.name}:${call.function.arguments}`;
    if (!callKeys.has(key)) { callKeys.add(key); uniqueCalls.push(call); }
  }
  return { calls: uniqueCalls, text: uniqueTexts.join('\n\n') };
}

function openAIResponse(model, data, mappings, stream = false) {
  const { calls, text } = outputSteps(data, mappings);
  const status = String(data?.status || '').toLowerCase();
  const safeText = text || (status === 'completed'
    ? 'Antigravity completed the turn without a text payload. Please retry the message.'
    : 'Antigravity returned no assistant content.');
  const finishReason = calls.length ? 'tool_calls' : 'stop';
  const message = calls.length
    ? { role: 'assistant', content: null, tool_calls: calls }
    : { role: 'assistant', content: safeText };
  const response = {
    id: String(data?.id || `chatcmpl_${crypto.randomBytes(8).toString('hex')}`),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }],
  };
  if (data?.usage && typeof data.usage === 'object') response.usage = data.usage;
  if (stream) {
    const delta = calls.length
      ? { role: 'assistant', tool_calls: calls }
      : { role: 'assistant', content: safeText };
    return [
      { id: response.id, object: 'chat.completion.chunk', created: response.created, model, choices: [{ index: 0, delta, finish_reason: finishReason }] },
      { id: response.id, object: 'chat.completion.chunk', created: response.created, model, choices: [{ index: 0, delta: {}, finish_reason: null }] },
    ];
  }
  return response;
}

export async function createAntigravityProxy({ apiKey, model = DEFAULT_AGENT, tokenLabel = 'lazydev-antigravity', endpoint = DEFAULT_ENDPOINT } = {}) {
  if (!apiKey) throw new Error('Gemini API key is required for the Antigravity proxy.');
  const token = crypto.randomBytes(24).toString('hex');
  const state = {
    interactionId: null,
    environmentId: null,
    mappings: new Map(),
    tools: BUILTIN_TOOLS.slice(),
    initialized: false,
  };
  const server = http.createServer((req, res) => {
    const expected = `Bearer ${token}`;
    if (req.headers.authorization !== expected) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Unauthorized' } }));
      return;
    }
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/v1/models' || url.pathname.startsWith('/v1/models/'))) {
      const single = url.pathname !== '/v1/models';
      const data = {
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google-antigravity',
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(single ? data : { object: 'list', data: [data] }));
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Not found' } }));
      return;
    }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 16 * 1024 * 1024) req.destroy(new Error('Request too large')); });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const { tools: externalTools, mappings } = toolDeclarations(body.tools);
        for (const [k, v] of mappings) state.mappings.set(k, v);
        state.tools = [...BUILTIN_TOOLS, ...externalTools];
        const hasToolResults = messages.at(-1)?.role === 'tool';
        const isFunctionResultContinuation = Boolean(hasToolResults && state.interactionId);
        let input;
        let payload = {
          agent: model,
          environment: state.environmentId || 'remote',
          // Antigravity's managed-agent function calling is stateful.
          // A function-result continuation references the previous interaction
          // and sends only the result; a fresh user turn declares tools again
          // because tools are interaction-scoped.
          agent_config: { type: 'antigravity', max_total_tokens: 50000 },
          store: true,
        };
        if (isFunctionResultContinuation) {
          input = toolResultInputs(messages, state.mappings);
        } else {
          input = state.interactionId
            ? (recentUserInput(messages) || transcriptInput(messages))
            : transcriptInput(messages);
          // Declare custom tools on every new interaction, but never on the
          // function-result continuation. This follows the official API flow.
          payload.tools = state.tools;
          state.initialized = true;
        }
        if (!input) input = 'Continue.';
        payload.input = input;
        if (state.interactionId) payload.previous_interaction_id = state.interactionId;
        let upstream = await postInteraction(endpoint, apiKey, payload);
        state.interactionId = String(upstream?.id || state.interactionId || '');
        state.environmentId = String(upstream?.environment_id || state.environmentId || '');

        // The raw REST Interactions response carries assistant text in
        // steps[].content[].text (model_output). Some proxy/CLI layers expose
        // output_text instead. If a completed response has neither, retrieve
        // the canonical Interaction once before declaring it empty.
        let parsed = outputSteps(upstream, state.mappings);
        if (upstream?.status === 'completed' && !parsed.calls.length && !parsed.text && state.interactionId) {
          try {
            const retrieved = await getInteraction(endpoint, apiKey, state.interactionId);
            if (retrieved && typeof retrieved === 'object') {
              upstream = { ...upstream, ...retrieved, steps: Array.isArray(retrieved.steps) ? retrieved.steps : upstream.steps };
              state.environmentId = String(retrieved?.environment_id || state.environmentId || '');
            }
          } catch {
            // Keep the original completed interaction; the caller can still
            // receive a useful diagnostic if the retry/retrieval is unavailable.
          }
        }

        const response = openAIResponse(model, upstream, state.mappings, Boolean(body.stream));
        if (Array.isArray(response)) {
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          for (const chunk of response) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(response));
        }
      } catch (error) {
        const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 502;
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: String(error?.message || error) } }));
      }
    });
  });
  await new Promise((resolve, reject) => {
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  if (!port) { try { server.close(); } catch {} throw new Error('Antigravity proxy failed to bind a loopback port.'); }
  return { server, token, port, model, tokenLabel };
}
