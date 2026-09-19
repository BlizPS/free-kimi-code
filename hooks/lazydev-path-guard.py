#!/usr/bin/env python3
"""Prevent standalone artifacts from being written into a project root."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path

try:
    event = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)
input_data = event.get("tool_input") or {}
target = str(input_data.get("file_path") or input_data.get("path") or input_data.get("filename") or "")
if not target:
    raise SystemExit(0)
cwd = Path(event.get("cwd") or os.getcwd()).resolve()
out = Path(os.getenv("LAZYDEV_ARTIFACT_DIR", Path.home() / ".local" / "share" / "lazydev" / "artifacts")).resolve()
resolved = Path(target).expanduser()
if not resolved.is_absolute():
    resolved = (cwd / resolved).resolve()
try:
    resolved.relative_to(out)
    raise SystemExit(0)
except ValueError:
    pass
ctx_path = Path(os.getenv("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev")) / "last-prompt.json"
try:
    ctx = json.loads(ctx_path.read_text(encoding="utf-8"))
except Exception:
    ctx = {}
prompt = str(ctx.get("prompt", ""))
artifact = bool((ctx.get("task") or {}).get("artifact")) or bool(re.search(r"\b(save|export|download|generate|create|produce|artifact|deliverable)\b", prompt, re.I))
standalone = resolved.suffix.lower().lstrip(".") in {"html","htm","pdf","docx","xlsx","pptx","zip","png","jpg","jpeg","webp","gif","svg","csv","md","txt"}
if artifact and standalone and resolved.parent == cwd:
    print(f"BLOCKED by LazyDev: write standalone deliverables under {out}. Target was {resolved}.", file=sys.stderr)
    raise SystemExit(2)
raise SystemExit(0)
