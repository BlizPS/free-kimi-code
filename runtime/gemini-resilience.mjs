const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export function geminiOpenAIEndpoint(model = '') {
  return `${GEMINI_OPENAI_BASE}chat/completions`;
}

export function isGeminiModel(model = '') {
  return /gemini/i.test(String(model || ''));
}

export function geminiReasoningFallbacks(model = '') {
  const id = String(model || '').toLowerCase();
  if (/2\.5|2-5/.test(id)) return ['none', 'low'];
  if (/2\.5|2-5/.test(id)) return ['none', 'low'];
  if (/3(?:\.\d+)?|3-|flash-lite/i.test(id)) return ['minimal', 'low', 'none'];
  return ['low', 'none'];
}

export function prepareGeminiRequest(input = {}, model = '') {
  const body = input && typeof input === 'object' ? structuredCloneSafe(input) : {};
  if (!isGeminiModel(model || body.model)) return body;
  body.model = String(model || body.model || '').trim();
  if (body.reasoning_effort == null || body.reasoning_effort === '') body.reasoning_effort = 'low';

  // Gemini counts thinking tokens toward max_output_tokens. A small hard cap can
  // therefore terminate the response while the model is still thinking.
  delete body.max_tokens;
  delete body.max_completion_tokens;

  // Do not send both OpenAI reasoning_effort and Gemini-specific thinking config.
  const extra = body.extra_body && typeof body.extra_body === 'object' && !Array.isArray(body.extra_body)
    ? body.extra_body
    : null;
  const google = extra?.google && typeof extra.google === 'object' && !Array.isArray(extra.google)
    ? extra.google
    : null;
  if (google?.thinking_config) {
    const nextGoogle = { ...google };
    delete nextGoogle.thinking_config;
    const nextExtra = { ...extra };
    if (Object.keys(nextGoogle).length) nextExtra.google = nextGoogle;
    else delete nextExtra.google;
    if (Object.keys(nextExtra).length) body.extra_body = nextExtra;
    else delete body.extra_body;
  }
  return body;
}

export function buildGeminiRetryRequest(input = {}, model = '', attempt = 0) {
  const body = prepareGeminiRequest(input, model);
  const fallbacks = geminiReasoningFallbacks(model);
  if (fallbacks[attempt]) body.reasoning_effort = fallbacks[attempt];
  return body;
}

export function parseSseEvent(block = '') {
  const lines = String(block || '').split(/\r?\n/);
  const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n').trim();
  if (!data || data === '[DONE]') return { done: data === '[DONE]', json: null };
  try { return { done: false, json: JSON.parse(data) }; } catch { return { done: false, json: null }; }
}

export function chunkHasVisibleOutput(chunk) {
  const choice = chunk?.choices?.[0];
  const delta = choice?.delta;
  if (typeof delta?.content === 'string' && delta.content.length > 0) return true;
  if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) return true;
  if (delta?.function_call && typeof delta.function_call === 'object') return true;
  return false;
}

export function chunkFinishReason(chunk) {
  return String(chunk?.choices?.[0]?.finish_reason || '').toLowerCase();
}

export function streamNeedsGeminiRetry({ finishReason, visibleOutput, retried = false } = {}) {
  if (retried || visibleOutput) return false;
  return /max_tokens|length|truncated/.test(String(finishReason || '').toLowerCase());
}

export function responseHasUsableOutput(payload) {
  const choice = payload?.choices?.[0];
  const message = choice?.message || {};
  const content = typeof message.content === 'string' ? message.content : '';
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const functionCall = message.function_call;
  return Boolean(content.length || toolCalls.length || (functionCall && typeof functionCall === 'object'));
}

function structuredCloneSafe(value) {
  try { return structuredClone(value); } catch {
    if (Array.isArray(value)) return value.map(structuredCloneSafe);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, structuredCloneSafe(v)]));
    return value;
  }
}
