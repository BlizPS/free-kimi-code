from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import importlib.util

spec = importlib.util.spec_from_file_location('lazydev_cli', ROOT / 'cli' / 'lazydev.py')
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

class Proxy:
    port = 47631
    token = 'test'

with tempfile.TemporaryDirectory() as tmp:
    mod.KIMI_HOME = Path(tmp) / 'kimi'
    mod.write_kimi_files(mod.PROVIDERS[0], {'providers': {'openrouter': {'model': 'openrouter/free', 'apiKey': 'x', 'modelInfo': {'context': 131072, 'output': 16384}}}}, Proxy())
    config = (mod.KIMI_HOME / 'config.toml').read_text(encoding='utf-8')
    assert 'default_max_chars = 100000' in config
    assert 'max_chars = 500000' in config
    assert 'event = "PostToolUse"' in config
    assert 'lazydev-artifact-router.py' in config
    assert 'lazydev-ui-audit.py' in config
print('PASS: native Kimi config has official Read budgets and non-blocking artifact/UI post-write hooks')
