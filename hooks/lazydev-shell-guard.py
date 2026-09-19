#!/usr/bin/env python3
"""Prevent shell commands from creating standalone deliverables in the project root."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path

try:
    event = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)
command = str((event.get("tool_input") or {}).get("command") or "")
if not command:
    raise SystemExit(0)
cwd = Path(event.get("cwd") or os.getcwd()).resolve()
out = Path(os.getenv("LAZYDEV_ARTIFACT_DIR", Path.home() / ".local" / "share" / "lazydev" / "artifacts")).resolve()
ctx_path = Path(os.getenv("LAZYDEV_CONTEXT_DIR", Path.home() / ".lazydev")) / "last-prompt.json"
try:
    ctx = json.loads(ctx_path.read_text(encoding="utf-8"))
except Exception:
    ctx = {}
prompt = str(ctx.get("prompt", ""))
artifact_intent = bool(re.search(r"\b(save|export|download|generate|create|produce|artifact|deliverable)\b", prompt, re.I))
ext = r"(?:html?|pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg|csv|md|txt)"
for match in re.finditer(r"(?:>|>>|tee|cp|mv|copy|move)\s+[^\n]*?([\w./\\-]+\." + ext + r")", command, re.I):
    target = Path(match.group(1))
    if not target.is_absolute():
        target = (cwd / target).resolve()
    else:
        target = target.resolve()
    if artifact_intent and target.parent == cwd and target != out and out not in target.parents:
        print(f"BLOCKED by LazyDev: write standalone deliverables under {out}.", file=sys.stderr)
        raise SystemExit(2)
raise SystemExit(0)
