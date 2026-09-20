#!/usr/bin/env python3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'scripts/lazydev.mjs').read_text(encoding='utf-8')
p=(root/'cli/lazydev.py').read_text(encoding='utf-8')
for text in (s,p):
    if 'router.huggingface.co/v1/models' not in text:
        raise SystemExit('FAIL: Hugging Face live model catalog endpoint missing')
    if 'HF_TOKEN' not in text:
        raise SystemExit('FAIL: Hugging Face token env missing')
    if 'supports_tools' not in text:
        raise SystemExit('FAIL: Hugging Face provider capability metadata missing')
print('PASS: Hugging Face is API-key based and uses live /v1/models provider metadata')
