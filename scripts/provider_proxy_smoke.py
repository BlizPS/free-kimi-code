#!/usr/bin/env python3
"""Offline regression tests for LazyDev's native and synthetic provider-tool bridge."""
from __future__ import annotations

import importlib.util
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lazydev_native_cli", ROOT / "cli" / "lazydev.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

seen: list[dict] = []

class Upstream(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *args):
        pass
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode())
        seen.append(body)
        if "unknown_gateway_flag" in body:
            payload = {"error": {"message": "Unsupported parameter(s): `unknown_gateway_flag`"}}
            data = json.dumps(payload).encode()
            self.send_response(400); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
        data = b'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
        self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); self.wfile.flush()

upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
threading.Thread(target=upstream.serve_forever, daemon=True).start()

try:
    provider = {"id": "openrouter", "label": "OpenRouter", "kind": "openai", "base": f"http://127.0.0.1:{upstream.server_address[1]}", "chat": f"http://127.0.0.1:{upstream.server_address[1]}/v1/chat/completions"}

    # Generic request repair still works.
    pc = {"apiKey": "test-key", "model": "model-test", "modelInfo": {"context": 32768, "output": 4096}}
    proxy = mod._ProviderProxy(provider, pc)
    try:
        body = {"model": "model-test", "messages": [{"role": "user", "content": "hello"}], "stream": True, "prompt_cache_key": "must-not-leak", "unknown_gateway_flag": True}
        req = Request(f"http://127.0.0.1:{proxy.port}/v1/chat/completions", data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {proxy.token}", "Content-Type": "application/json"}, method="POST")
        with urlopen(req, timeout=10) as response:
            payload = response.read().decode(); assert response.status == 200 and "data:" in payload, payload
    finally:
        proxy.close()

    # Capability comes from live metadata, not a model-id hardcode.
    assert mod.native_tool_capability({"modelInfo": {"toolUse": False}}) is False
    assert mod.native_tool_capability({"modelInfo": {"toolUse": True}}) is True
    assert mod.native_tool_capability({"modelInfo": {}}) is None

    # Context safety: a 32K model with ~11K input and a 29K completion request
    # must be clamped before the provider sees it. The exact model is irrelevant.
    context_pc = {"apiKey": "x", "model": "small-context-model", "modelInfo": {"context": 32768, "output": 32768}}
    oversized = {"model": "small-context-model", "messages": [{"role": "user", "content": "x" * 39000}], "max_tokens": 29491}
    normalized = mod._normalize_provider_request(oversized, provider, context_pc)
    assert int(normalized["max_tokens"]) < 29491, normalized
    assert int(normalized["max_tokens"]) <= 8192, normalized

    tiny_pc = {"apiKey": "x", "model": "tiny-context-model", "modelInfo": {"context": 8192, "output": 8192}}
    tiny = {"model": "tiny-context-model", "messages": [{"role": "user", "content": "x" * 5000}], "max_tokens": 8192}
    tiny_normalized = mod._normalize_provider_request(tiny, provider, tiny_pc)
    assert int(tiny_normalized["max_tokens"]) < 8192, tiny_normalized

    huge_pc = {"apiKey": "x", "model": "huge-context-model", "modelInfo": {"context": 1048576, "output": 131072}}
    huge = {"model": "huge-context-model", "messages": [{"role": "user", "content": "hello"}], "max_tokens": 131072}
    huge_normalized = mod._normalize_provider_request(huge, provider, huge_pc)
    assert int(huge_normalized["max_tokens"]) <= 16384, huge_normalized

    tool = {"type": "function", "function": {"name": "ReadFile", "description": "Read a file", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}}
    no_native_pc = {"apiKey": "test-key", "model": "same-model", "modelInfo": {"context": 32768, "output": 4096, "toolUse": False}}

    # Verify Kimi config keeps tool_use enabled because the loopback proxy provides the bridge.
    import tempfile
    old_home = mod.KIMI_HOME
    with tempfile.TemporaryDirectory() as td:
        mod.KIMI_HOME = Path(td)
        bridge_proxy = mod._ProviderProxy(provider, no_native_pc)
        try:
            cfg_provider = {"id": "openrouter", "label": "OpenRouter", "kind": "openai", "base": provider["base"]}
            cfg = {"providers": {"openrouter": no_native_pc}}
            config_path, _ = mod.write_kimi_files(cfg_provider, cfg, bridge_proxy)
            text = config_path.read_text(encoding="utf-8")
            assert 'capabilities = ["tool_use"]' in text, text
            assert '[tools]' not in text or 'disabled' not in text, text
        finally:
            bridge_proxy.close()
        mod.KIMI_HOME = old_home

    # Provider first rejects native tools; LazyDev learns that capability and retries the same model using the synthetic protocol.
    calls: list[dict] = []
    class NoToolsUpstream(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def log_message(self, *args): pass
        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0")); body = json.loads(self.rfile.read(length).decode()); calls.append(body)
            if any(k in body for k in ("tools", "tool_choice", "functions", "function_call")):
                payload = {"error": {"message": "No endpoints found that support tool use"}}
                data = json.dumps(payload).encode(); self.send_response(404); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
            prompt = "<lazydev_tool_call>{\"name\":\"ReadFile\",\"arguments\":{\"path\":\"README.md\"}}</lazydev_tool_call>"
            payload = {"id": "chatcmpl-test", "object": "chat.completion", "created": 1, "model": body["model"], "choices": [{"index": 0, "message": {"role": "assistant", "content": prompt}, "finish_reason": "stop"}]}
            data = json.dumps(payload).encode(); self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    nt = ThreadingHTTPServer(("127.0.0.1", 0), NoToolsUpstream); threading.Thread(target=nt.serve_forever, daemon=True).start()
    try:
        np = {"id": "openrouter", "label": "OpenRouter", "kind": "openai", "base": f"http://127.0.0.1:{nt.server_address[1]}", "chat": f"http://127.0.0.1:{nt.server_address[1]}/v1/chat/completions"}
        bridge = mod._ProviderProxy(np, {"apiKey": "x", "model": "same-model", "modelInfo": {"toolUse": None, "context": 32768, "output": 4096}})
        try:
            req_body = {"model": "same-model", "messages": [{"role": "user", "content": "read README"}], "tools": [tool], "tool_choice": "auto", "stream": True}
            req = Request(f"http://127.0.0.1:{bridge.port}/v1/chat/completions", data=json.dumps(req_body).encode(), headers={"Authorization": f"Bearer {bridge.token}", "Content-Type": "application/json"}, method="POST")
            with urlopen(req, timeout=10) as response:
                payload = response.read().decode(); assert response.status == 200 and "tool_calls" in payload, payload
            # The bridge learns the no-tools capability and caches it for the rest of the session.
            with urlopen(req, timeout=10) as response:
                payload2 = response.read().decode(); assert response.status == 200 and "tool_calls" in payload2, payload2
            assert len(calls) == 3, calls
            assert calls[0]["model"] == calls[1]["model"] == calls[2]["model"] == "same-model", calls
            assert "tools" in calls[0], calls[0]
            assert "tools" not in calls[1] and "<lazydev_tool_call>" in calls[1]["messages"][0]["content"], calls[1]
            assert "tools" not in calls[2] and "<lazydev_tool_call>" in calls[2]["messages"][0]["content"], calls[2]
            assert bridge.learned_no_tools is True, bridge.learned_no_tools
        finally:
            bridge.close()
    finally:
        nt.shutdown(); nt.server_close()

    assert all("prompt_cache_key" not in body for body in seen), seen
    print("PASS: native capability detection, same-model synthetic tool bridge, tool-result adaptation, and request repair")
finally:
    upstream.shutdown(); upstream.server_close()
