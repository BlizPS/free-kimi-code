#!/usr/bin/env python3
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "cli/lazydev.py"
assert CLI.is_file(), "native CLI missing"

spec = importlib.util.spec_from_file_location("lazydev_native_cli", CLI)
assert spec and spec.loader, "unable to load native CLI"
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def run(args):
    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = mod.main(args)
    return rc, out.getvalue(), err.getvalue()


for args, expected in [(["version"], "1.0.0"), (["--version"], "1.0.0")]:
    rc, stdout, stderr = run(args)
    assert rc == 0, stderr
    assert stdout.strip() == expected, stdout

rc, stdout, stderr = run(["env", "--json"])
assert rc == 0, stderr
data = json.loads(stdout)
assert data["nativeCliRuntime"] == "python"
assert data["node"] is None

rc, stdout, stderr = run(["skills"])
assert rc == 0 and "lazy-developer" in stdout, stderr

with tempfile.TemporaryDirectory() as td:
    rc, stdout, stderr = run(["lang", "--json", "--project", td])
    assert rc == 0, stderr


# Kimi Code 2.x requires every declared model alias to carry a positive
# max_context_size. Verify provider metadata and the unknown-model fallback
# both produce a valid TOML model definition.
with tempfile.TemporaryDirectory() as td:
    old_home = mod.KIMI_HOME
    mod.KIMI_HOME = Path(td) / "kimi-code"
    try:
        provider = {"id": "nvidia", "label": "NVIDIA", "kind": "openai", "base": "https://integrate.api.nvidia.com/v1"}
        cfg = {
            "providers": {
                "nvidia": {
                    "apiKey": "test-key",
                    "model": "Nvidia/nemotron-3-super-120b-a12b",
                    "modelInfo": {"context": 131072, "output": 16384, "toolUse": True},
                }
            }
        }
        config_path, _ = mod.write_kimi_files(provider, cfg)
        import tomllib
        parsed = tomllib.loads(config_path.read_text(encoding="utf-8"))
        model_entry = parsed["models"]["lazydev/Nvidia/nemotron-3-super-120b-a12b"]
        # Explicit saved metadata is preserved when it is already known, while
        # context display input budget is the full declared window so the TUI
        # does not show 100% merely because the reserved output headroom was
        # reached.
        assert model_entry["max_context_size"] == 131072
        assert model_entry["max_context_size"] > 0
        assert model_entry["max_output_size"] == 16384
        assert model_entry["max_input_size"] == 114688

        # The exact NVIDIA model has a documented 1M context and agent/tool
        # support; when metadata is absent the built-in model rule supplies it.
        cfg["providers"]["nvidia"]["modelInfo"] = {}
        config_path, _ = mod.write_kimi_files(provider, cfg)
        parsed = tomllib.loads(config_path.read_text(encoding="utf-8"))
        model_entry = parsed["models"]["lazydev/Nvidia/nemotron-3-super-120b-a12b"]
        assert model_entry["max_context_size"] == 1048576
        assert model_entry["max_input_size"] == 1032192
        assert model_entry["max_output_size"] == 16384
        assert "tool_use" in model_entry["capabilities"]
        assert model_entry["off_effort"] == "none"
    finally:
        mod.KIMI_HOME = old_home

# NVIDIA request normalization must use its documented chat-template controls
# and remove generic OpenAI reasoning controls that can be rejected or cause
# long reasoning traces to consume the entire max_tokens budget.
normalized = mod._normalize_provider_request({
    "model": "nvidia/nemotron-3-super-120b-a12b",
    "messages": [{"role": "user", "content": "hello"}],
    "tools": [{"type": "function", "function": {"name": "do_work"}}],
    "max_tokens": 999999,
    "prompt_cache_key": "drop",
    "reasoning_effort": "high",
}, {"id": "nvidia"}, {
    "model": "nvidia/nemotron-3-super-120b-a12b",
    "modelInfo": {},
})
assert "prompt_cache_key" not in normalized
assert "reasoning_effort" not in normalized
assert normalized["max_tokens"] == 16384
kwargs = normalized["extra_body"]["chat_template_kwargs"]
assert kwargs["enable_thinking"] is True and kwargs["low_effort"] is True and kwargs["force_nonempty_content"] is True


# Existing installs may contain a stale, differently-cased NVIDIA model id.
# The live catalog refresh must canonicalize it so the API receives the provider's
# actual model identifier and the 1M context metadata can be adopted.
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading, json as _json
class _ModelCatalog(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        payload = {"data": [{"id": "nvidia/nemotron-3-super-120b-a12b", "context_length": 1048576, "max_completion_tokens": 32768}]}
        raw = _json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

_catalog = ThreadingHTTPServer(("127.0.0.1", 0), _ModelCatalog)
threading.Thread(target=_catalog.serve_forever, daemon=True).start()
try:
    live_provider = {"id": "openai", "label": "OpenAI", "kind": "openai", "models": f"http://127.0.0.1:{_catalog.server_address[1]}/v1/models", "base": f"http://127.0.0.1:{_catalog.server_address[1]}/v1", "env": "OPENAI_API_KEY"}
    live_cfg = {"providers": {"openai": {"apiKey": "test-key", "model": "NVIDIA/Nemotron-3-Super-120B-A12B", "modelInfo": {"context": 32768, "output": 4096}}}}
    # Use the NVIDIA rule while exercising the catalog shape through a local endpoint.
    live_provider["id"] = "nvidia"
    live_provider["models"] = f"http://127.0.0.1:{_catalog.server_address[1]}/v1/models"
    live_provider["base"] = f"http://127.0.0.1:{_catalog.server_address[1]}/v1"
    live_cfg["providers"] = {"nvidia": {"apiKey": "test-key", "model": "NVIDIA/Nemotron-3-Super-120B-A12B", "modelInfo": {"context": 32768, "output": 4096}}}
    old_provider_models = mod.PROVIDERS[:]
    try:
        # Directly exercise the refresh helper with the local catalog provider definition.
        refreshed_pc = live_cfg["providers"]["nvidia"]
        refreshed = mod.refresh_selected_model(live_cfg, live_provider, refreshed_pc)
        assert refreshed_pc["model"] == "nvidia/nemotron-3-super-120b-a12b"
        assert refreshed["context"] == 1048576
        assert refreshed["output"] == 16384
    finally:
        mod.PROVIDERS[:] = old_provider_models
finally:
    _catalog.shutdown(); _catalog.server_close()

# The native chat path must clear the terminal before starting Kimi Code.
class _TTYBuffer:
    def __init__(self):
        self.value = ""
    def isatty(self):
        return True
    def write(self, value):
        self.value += value
        return len(value)
    def flush(self):
        pass

buffer = _TTYBuffer()
old_stdout = mod.sys.stdout
try:
    mod.sys.stdout = buffer
    mod.clear_terminal()
finally:
    mod.sys.stdout = old_stdout
assert "\x1b[2J" in buffer.value and "\x1b[3J" in buffer.value and "\x1b[H" in buffer.value


print("PASS: native Python LazyDev CLI, Kimi model context config, tool capabilities, and chat screen clearing")
