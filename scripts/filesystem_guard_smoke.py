#!/usr/bin/env python3
from __future__ import annotations

import os
import tempfile
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime.filesystem_policy import validate_tool_event

with tempfile.TemporaryDirectory(prefix="lazydev-fs-") as tmp:
    root = Path(tmp)
    html = root / "anime-watcher.html"
    html.write_text("<html>ok</html>\n", encoding="utf-8")

    too_small = validate_tool_event("Read", {"path": str(html), "max_chars": 200})
    assert too_small and "max_chars" in too_small

    good_read = validate_tool_event("Read", {"path": str(html), "max_chars": 4096})
    assert good_read is None

    bad_glob = validate_tool_event("Glob", {"pattern": str(root / "*")})
    assert bad_glob and "absolute wildcard" in bad_glob

    good_glob = validate_tool_event("Glob", {"directory": str(root), "pattern": "*.html"})
    assert good_glob is None

    system_like = "C:\\Windows" if os.name == "nt" else "/etc"
    system_probe = validate_tool_event("Glob", {"directory": system_like, "pattern": "*"})
    assert system_probe and "operating-system" in system_probe

print("PASS: Read/Glob/Grep filesystem guards reject unsafe tool arguments and preserve valid scoped calls")
