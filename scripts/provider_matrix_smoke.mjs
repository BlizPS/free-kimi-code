import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const providers = {
  openrouter: { catalog: 'https://openrouter.ai/api/v1/models', chat: 'https://openrouter.ai/api/v1/chat/completions', transport: 'openai' },
  gemini: { catalog: 'https://generativelanguage.googleapis.com/v1beta/models', transport: 'google-genai' },
  nvidia: { catalog: 'https://integrate.api.nvidia.com/v1/models', chat: 'https://integrate.api.nvidia.com/v1/chat/completions', transport: 'openai' },
  openai: { catalog: 'https://api.openai.com/v1/models', chat: 'https://api.openai.com/v1/chat/completions', transport: 'openai' },
  ollama: { catalog: '/api/tags', chat: '/v1/chat/completions', transport: 'ollama' },
  llm7: { catalog: 'https://api.llm7.io/v1/models', chat: 'https://api.llm7.io/v1/chat/completions', transport: 'openai' },
  groq: { catalog: 'https://api.groq.com/openai/v1/models', chat: 'https://api.groq.com/openai/v1/chat/completions', transport: 'openai' },
  codebuddy: { catalog: 'https://api.codebuddy.ai/v1/models', chat: 'https://api.codebuddy.ai/v1/chat/completions', transport: 'openai' },
  anthropic: { catalog: 'https://api.anthropic.com/v1/models', chat: 'https://api.anthropic.com/v1/messages', transport: 'anthropic' },
  pollinations: { catalog: 'https://text.pollinations.ai/models', chat: 'https://text.pollinations.ai/openai', transport: 'openai' },
};
for (const [id, spec] of Object.entries(providers)) {
  assert.ok(src.includes(`id: '${id}'`), `${id} provider missing`);
  for (const value of Object.values(spec).filter((v) => v.startsWith?.('http'))) assert.ok(src.includes(value), `${id}: missing ${value}`);
}
assert.ok(src.includes("const proxy = !['gemini', 'anthropic'].includes(provider.id)"), 'proxy boundary must keep native Gemini and Anthropic transports direct while allowing Ollama synthetic-tool bridging');
assert.ok(src.includes("provider.id === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'"), 'protocol split missing');
assert.ok(src.includes("const providerType = provider.id === 'gemini' && !antigravity && !geminiProxy ? 'google-genai'"), 'Gemini native provider type missing');
assert.ok(src.includes("base_url = ${tomlQuote('https://generativelanguage.googleapis.com')}"), 'Gemini native base URL missing');
assert.ok(src.includes("'authorization': `Bearer ${pc.apiKey}`"), 'bearer auth missing');
assert.ok(src.includes("'x-api-key': pc.apiKey"), 'Anthropic auth missing');
assert.ok(src.includes("function providerRequiresApiKey(provider)"), 'generic provider auth capability helper missing');
assert.ok(src.includes("auth: 'none', free: true"), 'Pollinations must be keyless/free');
assert.ok(src.includes("provider.kind === 'pollinations'"), 'Pollinations model/catalog adapter missing');
assert.ok(src.includes("integrate.api.nvidia.com/v1/chat/completions"), 'NVIDIA chat route missing');
console.log('PASS: provider matrix routes/protocols/auth are statically wired for 10 providers including keyless Pollinations');
