import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts', 'lazydev.mjs'), 'utf8');
const py = fs.readFileSync(path.join(root, 'cli', 'lazydev.py'), 'utf8');
const providers = {
  openrouter: { catalog: 'https://openrouter.ai/api/v1/models', chat: 'https://openrouter.ai/api/v1/chat/completions' },
  gemini: { catalog: 'https://generativelanguage.googleapis.com/v1beta/models' },
  nvidia: { catalog: 'https://integrate.api.nvidia.com/v1/models', chat: 'https://integrate.api.nvidia.com/v1/chat/completions' },
  openai: { catalog: 'https://api.openai.com/v1/models', chat: 'https://api.openai.com/v1/chat/completions' },
  ollama: { chat: '/v1/chat/completions' },
  llm7: { catalog: 'https://api.llm7.io/v1/models', chat: 'https://api.llm7.io/v1/chat/completions' },
  groq: { catalog: 'https://api.groq.com/openai/v1/models', chat: 'https://api.groq.com/openai/v1/chat/completions' },
  codebuddy: { catalog: 'https://api.codebuddy.ai/v1/models', chat: 'https://api.codebuddy.ai/v1/chat/completions' },
  anthropic: { catalog: 'https://api.anthropic.com/v1/models', chat: 'https://api.anthropic.com/v1/messages' },
  huggingface: { catalog: 'https://router.huggingface.co/v1/models', chat: 'https://router.huggingface.co/v1/chat/completions' },
  ninerouter: { catalog: 'http://127.0.0.1:20128/v1/models', chat: 'http://127.0.0.1:20128/v1/chat/completions' },
};
for (const [id, spec] of Object.entries(providers)) {
  assert.ok(src.includes(`id: '${id}'`), `${id} provider missing`);
  for (const value of Object.values(spec).filter((v) => v.startsWith?.('http'))) assert.ok(src.includes(value), `${id}: missing ${value}`);
}
assert.ok(py.includes("if provider[\"id\"] not in {\"anthropic\", \"gemini\"} or ui in {\"codex\", \"antigravity\"}:"), 'Python UI routing must create the shared proxy for Codex/Antigravity');
assert.ok(src.includes("provider.id === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'"), 'protocol split missing');
assert.ok(src.includes("const providerType = provider.id === 'gemini' && !geminiProxy ? 'google-genai'"), 'Gemini native provider type missing');
assert.ok(src.includes("base_url = ${tomlQuote('https://generativelanguage.googleapis.com')}"), 'Gemini native base URL missing');
assert.ok(src.includes("'authorization': `Bearer ${pc.apiKey}`"), 'bearer auth missing');
assert.ok(src.includes("'x-api-key': pc.apiKey"), 'Anthropic auth missing');
assert.ok(py.includes('def _openai_to_anthropic'), 'Python Anthropic adapter missing');
assert.ok(py.includes('def _anthropic_to_openai'), 'Python Anthropic response adapter missing');
assert.ok(py.includes('def _anthropic_sse_to_openai'), 'Python Anthropic streaming adapter missing');
assert.ok(py.includes('headers["x-api-key"] = key'), 'Python Anthropic API key header missing');
assert.ok(py.includes("env['GOOGLE_GEMINI_BASE_URL']=f'http://127.0.0.1:{proxy.port}'"), 'Antigravity must use proxy root URL, not duplicated /v1beta path');
assert.ok(py.includes('config_root = ARTIFACT_DIR / ".gemini-config"'), 'Antigravity canonical MCP config root missing');
assert.ok(py.includes('native_root = HOME / ".gemini" / "config"'), 'Antigravity native MCP compatibility path missing');
assert.ok(py.includes('home = ARTIFACT_DIR / ".codex"'), 'Codex canonical home missing');
assert.ok(py.includes('cwd=str(ARTIFACT_DIR)'), 'Shared lazydevfile workspace root missing');
assert.ok(src.includes("function providerRequiresApiKey(provider)"), 'generic provider auth capability helper missing');
assert.ok(src.includes("integrate.api.nvidia.com/v1/chat/completions"), 'NVIDIA chat route missing');
assert.ok(src.includes('function runNativeChat()'), 'Node wrapper must delegate chat to native Python runtime');
assert.ok(src.includes('cli/lazydev.py'), 'Node wrapper must delegate to shared Python runtime');
console.log('PASS: provider matrix routes/protocols/auth are statically wired for 11 providers with 9Router at #11');
