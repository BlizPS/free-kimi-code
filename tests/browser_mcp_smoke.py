#!/usr/bin/env python3
"""Contract tests for the dependency-free LazyDev browser MCP adapters."""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PY_SERVER = ROOT / "runtime" / "browser-mcp.py"
MJS_SERVER = ROOT / "runtime" / "browser.mjs"


def run_server(command: list[str]) -> list[dict]:
    env = dict(os.environ)
    env["LAZYDEV_BROWSER_ALLOW_PRIVATE"] = "1"
    env["LAZYDEV_BROWSER_TEST_UNAVAILABLE"] = "1"
    proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
    assert proc.stdin and proc.stdout
    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_web", "arguments": {"query": "test"}}},
    ]
    for request in requests:
        proc.stdin.write(json.dumps(request) + "\n")
    proc.stdin.flush()
    lines = [json.loads(proc.stdout.readline()) for _ in requests]
    proc.terminate()
    proc.wait(timeout=2)
    return lines


def main() -> None:
    py = run_server([sys.executable, str(PY_SERVER)])
    assert py[0]["result"]["serverInfo"] == {"name": "lazydev-browser", "version": "1.0.0"}
    names = {item["name"] for item in py[1]["result"]["tools"]}
    assert {"search_web", "browser_open", "browser_links"} <= names
    assert "error" not in py[2], "network failure must be a tool result, not MCP transport error"
    assert py[2]["result"]["structuredContent"]["status"] in {"ok", "unavailable"}
    assert py[2]["result"].get("isError") in {None, True}

    import shutil
    node = shutil.which("node")
    if node:
        js = run_server([node, str(MJS_SERVER)])
        assert js[0]["result"]["serverInfo"] == {"name": "lazydev-browser", "version": "1.0.0"}
        names = {item["name"] for item in js[1]["result"]["tools"]}
        assert {"search_web", "browser_open", "browser_links"} <= names
        assert "error" not in js[2]
        assert js[2]["result"]["structuredContent"]["status"] in {"ok", "unavailable"}

    print("PASS: LazyDev Browser MCP Python + MJS contracts")


if __name__ == "__main__":
    main()
