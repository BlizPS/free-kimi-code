#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/'scripts/lazydev.mjs').read_text(encoding='utf-8')
legacy_label = 'OpenAI ' + ''.join(chr(x) for x in [82,101,115,112,111,110,115,101,115])
legacy_kind = 'openai_' + ''.join(chr(x) for x in [114,101,115,112,111,110,115,101,115])
if legacy_label in text or legacy_kind in text:
    raise SystemExit('FAIL: legacy OpenAI provider naming remains')
expected = [
    ('openrouter', 'OpenRouter'), ('gemini', 'Gemini'), ('nvidia', 'NVIDIA'),
    ('openai', 'OpenAI'), ('ollama', 'Ollama Local'), ('llm7', 'LLM7'),
    ('groq', 'Groq'), ('codebuddy', 'CodeBuddy'), ('anthropic', 'Anthropic'),
]
for pid, label in expected:
    if f"id: '{pid}'" not in text or f"label: '{label}'" not in text:
        raise SystemExit(f'FAIL: missing provider {label}')
if "Provider [1-${providers.length}]" not in text:
    raise SystemExit('FAIL: setup provider range is not dynamic')
print('PASS: 9 provider menu and canonical OpenAI label are present')
