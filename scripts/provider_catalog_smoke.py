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
}
for name, url in checks.items():
    if url not in s:
        raise SystemExit(f'FAIL: no live catalog endpoint for {name}')
for needle in ['function normalizeOllamaBaseUrl', 'function ollamaModelsUrl', "id: 'ollama'", '/api/tags', '/v1/models']:
    if needle not in s:
        raise SystemExit(f'FAIL: Ollama local catalog support missing: {needle}')
if 'AbortController' not in s or 'Request timed out after' not in s:
    raise SystemExit('FAIL: bounded live-model request timeout is missing')
print('PASS: live catalog endpoints, Ollama local discovery, and timeout handling are wired')
