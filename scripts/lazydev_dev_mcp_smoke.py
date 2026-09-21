from __future__ import annotations
import importlib.util
import io
import json
import os
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/"runtime"/"lazydev-dev-mcp.py"
spec=importlib.util.spec_from_file_location("lazydev_dev_mcp", path)
mod=importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)

with tempfile.TemporaryDirectory() as td:
    root=Path(td)
    (root/"src").mkdir()
    (root/"src"/"demo.py").write_text("def hello():\n    return 42\n")
    os.environ["LAZYDEV_PROJECT_ROOT"] = str(root)
    tree=mod.list_files(".", "*", 20)
    assert "src/" in tree["files"]
    read=mod.read_file("src/demo.py")
    assert "return 42" in read["content"]
    found=mod.search_code("return 42")
    assert found["results"] and found["results"][0]["path"] == "src/demo.py"
print("PASS: lazydev-dev MCP starts dependency-free and enforces project-root tools")
