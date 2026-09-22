#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lazydev", ROOT / "cli" / "lazydev.py")
if not spec or not spec.loader:
    raise SystemExit("could not load LazyDev CLI")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def main() -> None:
    saved = (mod.find_kimi, mod.find_codex, mod.find_antigravity, mod.find_claude, mod.find_deepseek_harness)
    try:
        mod.find_kimi = lambda: "/fake/kimi"
        mod.find_codex = lambda: "/fake/codex"
        mod.find_antigravity = lambda: "/fake/agy"
        mod.find_claude = lambda: "/fake/claude"
        mod.find_deepseek_harness = lambda: "/fake/dsh"
        chat = [x[:2] for x in mod.installed_chat_uis(include_web=True)]
        resume = [x[:2] for x in mod.installed_chat_uis(include_web=False)]
        assert chat == [
            ("kimi", "Kimi Code"),
            ("codex", "Codex"),
            ("antigravity", "Antigravity"),
            ("claude", "Claude Code"),
            ("deepseek", "DeepSeek Harness"),
        ], chat
        assert resume == [
            ("kimi", "Kimi Code"),
            ("codex", "Codex"),
            ("antigravity", "Antigravity"),
            ("claude", "Claude Code"),
        ], resume
    finally:
        (mod.find_kimi, mod.find_codex, mod.find_antigravity, mod.find_claude, mod.find_deepseek_harness) = saved

    provider = {"id": "openrouter", "label": "OpenRouter", "kind": "openai", "base": "http://127.0.0.1:1/v1"}
    pc = {"model": "provider/private", "modelInfo": {"context": 32768, "output": 4096}}
    proxy = mod._ProviderProxy(provider, pc)
    try:
        with tempfile.TemporaryDirectory() as td:
            old_home, old_dsh_home = mod.DEEPSEEK_HARNESS_HOME, mod.Path(td) / "dsh-home"
            mod.DEEPSEEK_HARNESS_HOME = old_dsh_home
            patch = mod._write_deepseek_harness_patch(proxy, provider, pc).read_text(encoding="utf-8")
            assert f"baseURL: \"http://127.0.0.1:{proxy.port}/v1\"" in patch, patch
            assert 'protocol: "chat-completions"' in patch, patch
            assert 'id: "sonnet"' in patch, patch
            assert 'name: "Sonnet"' in patch, patch
            assert 'provider: "deepseek"' in patch, patch
            mod.DEEPSEEK_HARNESS_HOME = old_home
    finally:
        proxy.close()

    # Claude proxy streaming must emit the first content before the upstream closes.
    class FakeResponse(io.BytesIO):
        def readline(self, *args, **kwargs):
            return super().readline(*args, **kwargs)

    raw = (
        b'data: {"id":"x","choices":[{"delta":{"content":"hello"},"finish_reason":null}]}\n\n'
        b'data: {"id":"x","choices":[{"delta":{"content":" world"},"finish_reason":"stop"}],"usage":{"completion_tokens":2}}\n\n'
        b'data: [DONE]\n\n'
    )
    response = FakeResponse(raw)
    writer = io.BytesIO()
    mod._stream_openai_http_to_anthropic(response, writer, "sonnet")
    stream = writer.getvalue().decode("utf-8")
    assert 'text_delta' in stream and 'hello' in stream and ' world' in stream, stream
    assert 'message_stop' in stream, stream
    assert '"model":"sonnet"' in stream, stream

    print("PASS: DeepSeek Harness picker #5, local proxy config, and Claude streaming relay")


if __name__ == "__main__":
    main()
