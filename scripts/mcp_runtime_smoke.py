from __future__ import annotations
import importlib.util
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lazydev", ROOT / "cli" / "lazydev.py")
mod = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)

assert not hasattr(mod, "_context7_mcp_entry")
entry = mod._lazydev_dev_mcp_entry()
assert entry["args"][-1].endswith("lazydev-dev-mcp.py")
assert entry["command"]

with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    (root / "hello.py").write_text("print('hello')\nanswer = 42\n")
    old = os.getcwd()
    os.chdir(root)
    try:
        result = mod._lazydev_dev_mcp_entry()
        assert result["env"]["LAZYDEV_PROJECT_ROOT"] == str(root)
        cfg = mod.write_kimi_mcp_config()
        data = json.loads(cfg.read_text())
        servers = data["mcpServers"]
        assert "lazydev-dev" in servers
        assert "context7" not in servers
        dev = servers["lazydev-dev"]
        assert dev["args"][0].endswith("lazydev-dev-mcp.py")
        assert dev["startupTimeoutMs"] == 5000
        assert dev["toolTimeoutMs"] == 30000
    finally:
        os.chdir(old)
print('PASS: built-in dependency-free LazyDev dev MCP is configured and Context7 is removed')
