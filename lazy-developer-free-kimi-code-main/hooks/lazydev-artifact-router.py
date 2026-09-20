#!/usr/bin/env python3
"""Route standalone artifacts to the canonical LazyDev output directory after a successful write."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime.artifact_router import route_written_artifact  # noqa: E402

try:
    event = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)

name = str(event.get("tool_name") or "")
if name not in {"Write", "WriteFile"}:
    raise SystemExit(0)
input_data = event.get("tool_input") or {}
target = input_data.get("file_path") or input_data.get("path") or input_data.get("filename")
prompt = ""
try:
    context_path = Path(event.get("cwd") or ".") / ".lazydev-last-prompt.json"
    if not context_path.is_file():
        home = Path(__import__("os").environ.get("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev"))
        context_path = home / "last-prompt.json"
    prompt = str(json.loads(context_path.read_text(encoding="utf-8")).get("prompt", ""))
except Exception:
    prompt = ""
if target:
    moved = route_written_artifact(str(target), prompt, event.get("cwd"))
    if moved:
        src, destination = moved
        print(f"LazyDev artifact router: saved standalone deliverable at {destination}.")
raise SystemExit(0)
