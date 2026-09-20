#!/usr/bin/env python3
"""Non-blocking post-write HTML asset QA for LazyDev UI work."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime.ui_artifact_policy import audit_html_file  # noqa: E402

try:
    event = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)

name = str(event.get("tool_name") or "")
if name not in {"Write", "WriteFile", "Edit", "StrReplaceFile"}:
    raise SystemExit(0)
input_data = event.get("tool_input") or {}
target = input_data.get("file_path") or input_data.get("path") or input_data.get("filename")
if not target or Path(str(target)).suffix.lower() not in {".html", ".htm"}:
    raise SystemExit(0)
context_file = Path(os.getenv("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev")) / "last-prompt.json"
prompt = ""
try:
    prompt = str(json.loads(context_file.read_text(encoding="utf-8")).get("prompt") or "")
except (OSError, ValueError, TypeError):
    pass
issues = audit_html_file(str(target), prompt)
if issues:
    print("LazyDev UI QA: " + " | ".join(issues[:6]))
raise SystemExit(0)
