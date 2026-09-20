#!/usr/bin/env python3
import json, os, tempfile, importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('fs_policy', ROOT / 'runtime' / 'filesystem_policy.py')
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

with tempfile.TemporaryDirectory() as tmp:
    home = Path(tmp) / '.kimi-code'; home.mkdir()
    (home / 'lazydev-last-prompt.json').write_text(json.dumps({
        'prompt': 'Fix the downloader in tiktok.html',
        'task': {'focusFiles': ['tiktok.html']},
    }), encoding='utf-8')
    old = os.environ.get('KIMI_CODE_HOME'); os.environ['KIMI_CODE_HOME'] = str(home)
    try:
        assert mod.validate_tool_event('Read', {'path': '/tmp/tiktok.html', 'max_chars': 4096}) is None
        blocked = mod.validate_tool_event('Read', {'path': '/tmp/anime.html', 'max_chars': 4096})
        assert blocked and 'unrelated html' in blocked.lower()
        assert mod.validate_tool_event('Read', {'path': '/tmp/about.css', 'max_chars': 4096}) is None
    finally:
        if old is None: os.environ.pop('KIMI_CODE_HOME', None)
        else: os.environ['KIMI_CODE_HOME'] = old
print('PASS: explicit task file scope blocks unrelated HTML reads')
