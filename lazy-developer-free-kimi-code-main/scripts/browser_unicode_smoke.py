#!/usr/bin/env python3
from __future__ import annotations
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import importlib.util
_spec = importlib.util.spec_from_file_location("lazydev_browser_mcp", ROOT / "runtime" / "browser-mcp.py")
assert _spec and _spec.loader
browser_mcp = importlib.util.module_from_spec(_spec)
sys.modules["lazydev_browser_mcp"] = browser_mcp
_spec.loader.exec_module(browser_mcp)

class CaptureStdout:
    def __init__(self) -> None:
        self.buffer = io.BytesIO()
    def write(self, value: str) -> int:
        return len(value)
    def flush(self) -> None:
        return None

request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {"name": "テスト", "arguments": {}},
}
response = browser_mcp.handle(request)
capture = CaptureStdout()
original = sys.stdout
try:
    sys.stdout = capture  # type: ignore[assignment]
    browser_mcp.write_json_line(response)
finally:
    sys.stdout = original

payload = json.loads(capture.buffer.getvalue())
message = payload.get("error", {}).get("message", "")
if "Unknown tool: テスト" not in message:
    raise SystemExit(f"Unicode MCP response was corrupted: {payload!r}")

print("browser MCP Unicode smoke: PASS")
