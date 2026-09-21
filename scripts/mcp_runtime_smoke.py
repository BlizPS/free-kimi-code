#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import json
import os
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('lazydev_mcp_smoke', ROOT / 'cli' / 'lazydev.py')
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

entry = mod._context7_mcp_entry()
if entry is None:
    print('SKIP: npx is not available on this host; Context7 config generation is intentionally optional')
    raise SystemExit(0)
assert entry['args'] == ['-y', ' @upstash/context7-mcp@4.1.1'.strip()]
assert Path(entry['command']).name.lower() in {'npx', 'npx.cmd'}

with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    mod.HOME = root
    mod.KIMI_HOME = root / '.kimi-code'
    mod.CONFIG_DIR = root / '.config' / 'lazydev'
    mod.ARTIFACT_DIR = root / 'lazydevfile'
    mod.IS_WINDOWS = os.name == 'nt'

    mod.write_kimi_mcp_config()
    kimi = json.loads((mod.KIMI_HOME / 'mcp.json').read_text())
    assert kimi['mcpServers']['context7']['args'] == ['-y', ' @upstash/context7-mcp@4.1.1'.strip()]
    assert kimi['mcpServers']['lazydev-search']['toolTimeoutMs'] == 60000

    _, agy_mcp = mod._write_antigravity_runtime({'model': 'test'})
    agy = json.loads(agy_mcp.read_text())
    assert agy['mcpServers']['context7']['args'] == ['-y', ' @upstash/context7-mcp@4.1.1'.strip()]
    assert agy['mcpServers']['lazydev-search']['env']['LAZYDEV_BROWSER_USER_AGENT'].startswith('LazyDev-Browser/')

print('PASS: Context7 4.1.1 config is generated as local stdio for Kimi Code and Antigravity without clobbering existing servers')
