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
assert.ok(py.includes("if provider[\"id\"] not in {\"anthropic\", \"gemini\"} or ui in {\"codex\", \"antigravity\", \"claude\"}:"), 'Python UI routing must create the shared proxy for Codex/Antigravity/Claude Code');
assert.ok(src.includes("provider.id === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'"), 'protocol split missing');
assert.ok(src.includes("const providerType = provider.id === 'gemini' && !geminiProxy ? 'google-genai'"), 'Gemini native provider type missing');
assert.ok(src.includes("base_url = ${tomlQuote('https://generativelanguage.googleapis.com')}"), 'Gemini native base URL missing');
assert.ok(src.includes("'authorization': `Bearer ${pc.apiKey}`"), 'bearer auth missing');
assert.ok(src.includes("'x-api-key': pc.apiKey"), 'Anthropic auth missing');
assert.ok(py.includes('def _openai_to_anthropic'), 'Python Anthropic adapter missing');
assert.ok(py.includes('def _anthropic_request_to_openai'), 'Claude Code request adapter missing');
assert.ok(py.includes('def _openai_sse_to_anthropic'), 'Claude Code streaming adapter missing');
assert.ok(py.includes('def _launch_claude'), 'Claude Code launcher missing');
assert.ok(py.includes('ANTHROPIC_BASE_URL'), 'Claude Code proxy environment missing');
assert.ok(py.includes('CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY'), 'Claude Code gateway model discovery missing');
assert.ok(py.includes('def _claude_messaging_args'), 'Claude Code user-namespace messaging fallback missing');
assert.ok(py.includes('def _ensure_claude_skills'), 'Claude Code LazyDev skill sync helper missing');
assert.ok(py.includes('HOME / ".claude" / "skills"'), 'Claude Code native skill directory missing');
assert.ok(py.includes('CLAUDE_EXPOSED_MODEL_ALIAS = "sonnet"'), 'Claude stable model alias missing');
assert.ok(py.includes('env["ANTHROPIC_MODEL"] = CLAUDE_EXPOSED_MODEL_ALIAS'), 'Claude launcher must pin a stable native model alias');
assert.ok(py.includes('env["DISABLE_GROWTHBOOK"] = "1"'), 'Android Claude messaging regression guard missing');
assert.ok(py.includes('def _claude_android_messaging_workaround_needed'), 'Android Claude messaging compatibility detector missing');
assert.ok(py.includes('def _claude_unshare_prefix'), 'Claude mapped user-namespace launcher missing');
assert.ok(py.includes('env["DISABLE_GROWTHBOOK"] = "1"'), 'Claude background fallback missing');
assert.ok(py.includes('CLAUDE_ANDROID_MESSAGING_BUG_MIN = (2, 1, 248)'), 'Claude Android regression range minimum missing');
assert.ok(py.includes('CLAUDE_ANDROID_MESSAGING_BUG_MAX = (2, 1, 251)'), 'Claude Android regression range maximum missing');
assert.ok(py.includes('--messaging-socket-path'), 'Claude Code explicit messaging socket escape hatch missing');
assert.ok(py.includes('def _anthropic_to_openai'), 'Python Anthropic response adapter missing');
assert.ok(py.includes('def _anthropic_sse_to_openai'), 'Python Anthropic streaming adapter missing');
assert.ok(py.includes('headers["x-api-key"] = key'), 'Python Anthropic API key header missing');
assert.ok(py.includes("env['GOOGLE_GEMINI_BASE_URL']=f'http://127.0.0.1:{proxy.port}'"), 'Antigravity must use proxy root URL, not duplicated /v1beta path');
assert.ok(py.includes('native_root = HOME / ".gemini" / "config"'), 'Antigravity native MCP config root missing');
assert.ok(py.includes('home = HOME / \".gemini\" / \"antigravity-cli\"') || py.includes('native = HOME / \".gemini\" / \"antigravity-cli\"'), 'Antigravity native home missing');
assert.ok(py.includes('def _codex_runtime_home()'), 'Codex runtime-home compatibility helper missing');
assert.ok(py.includes('home = _codex_runtime_home()'), 'Codex runtime home selection missing');
assert.ok(py.includes('wire_api = \"responses\"'), 'Codex must use Responses wire API');
assert.ok(py.includes('home = HOME / \".codex\"'), 'Desktop Codex home must stay native to the user home');
assert.ok(py.includes('native = HOME / \".gemini\" / \"antigravity-cli\"'), 'Antigravity home must stay native to the user home');
assert.ok(py.includes('shared = HOME / \".agents\" / \"skills\"'), 'Generic shared skills must live in the OS user home');
assert.ok(py.includes('class _ResponsesProxy'), 'Codex Responses bridge missing');
assert.ok(py.includes('input_tokens_details'), 'Codex Responses usage conversion missing');
assert.ok(py.includes('codex-model-catalog.json'), 'Codex model catalog missing');
assert.ok(py.includes('cwd=str(ARTIFACT_DIR)'), 'Shared lazydevfile workspace root missing');
assert.ok(py.includes('home = HOME / ".codex"'), 'Desktop Codex native home missing');
assert.ok(src.includes("function providerRequiresApiKey(provider)"), 'generic provider auth capability helper missing');
assert.ok(src.includes("integrate.api.nvidia.com/v1/chat/completions"), 'NVIDIA chat route missing');
assert.ok(src.includes("function runNativeCommand(subcommand = 'chat')"), 'Node wrapper must delegate chat to native Python runtime');
assert.ok(src.includes('cli/lazydev.py'), 'Node wrapper must delegate to shared Python runtime');
console.log('PASS: provider matrix routes/protocols/auth and Claude Code native UI proxy are statically wired');
