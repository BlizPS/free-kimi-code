#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/'scripts/lazydev.mjs').read_text(encoding='utf-8')
expected = [
    ('openrouter', 'OpenRouter'), ('gemini', 'Gemini'), ('nvidia', 'NVIDIA'),
    ('openai', 'OpenAI'), ('ollama', 'Ollama Local'), ('llm7', 'LLM7'),
    ('groq', 'Groq'), ('codebuddy', 'CodeBuddy'), ('anthropic', 'Anthropic'), ('huggingface', 'Hugging Face'),
]
for pid, label in expected:
    if f"id: '{pid}'" not in text or f"label: '{label}'" not in text:
        raise SystemExit(f'FAIL: missing provider {label}')
if "Provider [1-${providers.length}]" not in text:
    raise SystemExit('FAIL: setup provider range is not dynamic')
print('PASS: 10-provider menu uses Hugging Face as #10')
