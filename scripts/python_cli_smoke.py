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
        assert model_entry["max_context_size"] == 131072
        assert model_entry["max_context_size"] > 0
        assert model_entry["max_output_size"] == 16384
        assert model_entry["max_input_size"] == 114688

        cfg["providers"]["nvidia"]["modelInfo"] = {"toolUse": False}
        config_path, _ = mod.write_kimi_files(provider, cfg)
        parsed = tomllib.loads(config_path.read_text(encoding="utf-8"))
        model_entry = parsed["models"]["lazydev/Nvidia/nemotron-3-super-120b-a12b"]
        assert model_entry["max_context_size"] == 32768
        assert "tool_use" not in model_entry["capabilities"]
    finally:
        mod.KIMI_HOME = old_home

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
