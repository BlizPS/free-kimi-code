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

print("PASS: native Python LazyDev CLI version, env, skills, and language commands")
