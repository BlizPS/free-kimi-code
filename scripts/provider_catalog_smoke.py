#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'scripts/lazydev.mjs').read_text(encoding='utf-8')
checks = {
 'OpenRouter': 'https://openrouter.ai/api/v1/models',
 'Gemini': 'https://generativelanguage.googleapis.com/v1beta/models',
 'NVIDIA': 'https://integrate.api.nvidia.com/v1/models',
 'OpenAI': 'https://api.openai.com/v1/models',
 'LLM7': 'https://api.llm7.io/v1/models',
 'Groq': 'https://api.groq.com/openai/v1/models',
 'CodeBuddy': 'https://api.codebuddy.ai/v1/models',
 'Anthropic': 'https://api.anthropic.com/v1/models',
 'Hugging Face': 'https://router.huggingface.co/v1/models',
}
for name, url in checks.items():
    if url not in s:
        raise SystemExit(f'FAIL: no live catalog endpoint for {name}')
for needle in ["id: 'huggingface'", "env: 'HF_TOKEN'", "provider.id === 'huggingface'", 'supports_tools', 'function providerRequiresApiKey(provider)', 'function normalizeOllamaBaseUrl', 'function ollamaModelsUrl']:
    if needle not in s:
        raise SystemExit(f'FAIL: required provider/capability wiring missing: {needle}')
if 'AbortController' not in s or 'Request timed out after' not in s:
    raise SystemExit('FAIL: bounded live-model request timeout is missing')
print('PASS: live model catalogs, HF API-key routing, provider capability metadata, Ollama discovery, and timeouts are wired')
