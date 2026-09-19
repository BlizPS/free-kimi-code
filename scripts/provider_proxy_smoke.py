#!/usr/bin/env python3
"""Offline regression tests for the native LazyDev provider compatibility proxy."""
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

seen = []

class Upstream(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode())
        seen.append({"path": self.path, "body": body})
        if "unknown_gateway_flag" in body:
            payload = {"error": {"message": "Unsupported parameter(s): `unknown_gateway_flag`"}}
            data = json.dumps(payload).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        data = b'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()

upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
threading.Thread(target=upstream.serve_forever, daemon=True).start()

try:
    providers = {
        "openrouter": ("/v1", "openrouter/free"),
        "gemini": ("/v1", "gemini-test"),
        "nvidia": ("/v1", "nvidia-test"),
        "openai": ("/v1", "gpt-test"),
        "ollama": ("", "llama-test"),
        "llm7": ("/v1", "llm7-test"),
        "groq": ("/v1", "groq-test"),
        "codebuddy": ("/v1", "cb-test"),
    }
    for pid, (suffix, model) in providers.items():
        base = f"http://127.0.0.1:{upstream.server_address[1]}{suffix}"
        provider = {"id": pid, "label": pid, "kind": "openai", "base": base}
        pc = {"apiKey": "test-key", "model": model, "modelInfo": {"context": 32768, "output": 4096}}
        proxy = mod._ProviderProxy(provider, pc)
        try:
            body = {
                "model": model,
                "messages": [{"role": "user", "content": "hello"}],
                "stream": True,
                "prompt_cache_key": "must-not-leak",
                "unknown_gateway_flag": True,
            }
            req = Request(
                f"http://127.0.0.1:{proxy.port}/v1/chat/completions",
                data=json.dumps(body).encode(),
                headers={"Authorization": f"Bearer {proxy.token}", "Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=10) as response:
                payload = response.read().decode()
                assert response.status == 200
                assert "data:" in payload
        finally:
            proxy.close()

    assert seen, "upstream did not receive requests"
    assert all("prompt_cache_key" not in item["body"] for item in seen), seen
    assert all(item["body"]["model"] for item in seen), seen
    for pid, (_, model) in providers.items():
        matching = [item for item in seen if item["body"]["model"] == model]
        assert matching, f"missing upstream traffic for {pid}"
        assert "unknown_gateway_flag" not in matching[-1]["body"], matching[-1]
    assert len(seen) >= len(providers) * 2, "dynamic 400 repair did not retry each provider"
    print("PASS: provider proxy strips known cache fields, dynamically repairs unsupported fields, preserves streaming, and covers all OpenAI-compatible providers")
finally:
    upstream.shutdown()
    upstream.server_close()
