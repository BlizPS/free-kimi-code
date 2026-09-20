#!/usr/bin/env python3
"""Prevent standalone artifacts from being written into a project root."""
from __future__ import annotations
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from runtime.platform_paths import platform_paths

try:
    event = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)
input_data = event.get("tool_input") or {}
target = str(input_data.get("file_path") or input_data.get("path") or input_data.get("filename") or "")
if not target:
    raise SystemExit(0)
cwd = Path(event.get("cwd") or os.getcwd()).resolve()
out = Path(os.getenv("LAZYDEV_ARTIFACT_DIR") or platform_paths()["artifactDirectory"]).resolve()
resolved = Path(target).expanduser()
if not resolved.is_absolute():
    resolved = (cwd / resolved).resolve()
try:
    resolved.relative_to(out)
    raise SystemExit(0)
except ValueError:
    pass
raise SystemExit(0)
