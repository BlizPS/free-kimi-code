#!/usr/bin/env python3
"""Prevent fragile filesystem tool arguments from reaching Kimi Code."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from runtime.filesystem_policy import validate_tool_event  # noqa: E402

try:
    payload = json.loads(sys.stdin.read() or "{}")
except Exception:
    raise SystemExit(0)

message = validate_tool_event(payload.get("tool_name"), payload.get("tool_input"))
if message:
    print(f"LazyDev filesystem guard: {message}", file=sys.stderr)
    raise SystemExit(2)
raise SystemExit(0)
