#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / "hooks" / "lazydev-research-gate.py"
spec = importlib.util.spec_from_file_location("lazydev_research_gate", HOOK)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory() as tmp:
    gate = lambda payload: module.handle(payload, tmp)
    code, _ = gate({"hook_event_name":"UserPromptSubmit","session_id":"s1","prompt":"Build a Three.js 3D configurator"}); assert code == 0
    code, msg = gate({"hook_event_name":"PreToolUse","session_id":"s1","tool_name":"Write","tool_input":{"file_path":"scene.js"}}); assert code == 2 and "research gate" in msg.lower()
    code, _ = gate({"hook_event_name":"PostToolUse","session_id":"s1","tool_name":"WebSearch","tool_output":"official Three.js example"}); assert code == 0
    code, _ = gate({"hook_event_name":"PreToolUse","session_id":"s1","tool_name":"Write","tool_input":{"file_path":"scene.js"}}); assert code == 0
    code, _ = gate({"hook_event_name":"UserPromptSubmit","session_id":"s2","prompt":"Optimize SEO for this website"}); assert code == 0
    code, _ = gate({"hook_event_name":"PreToolUse","session_id":"s2","tool_name":"Edit","tool_input":{"file_path":"index.html"}}); assert code == 2
print("PASS: native 3D/SEO research gate blocks writes until research evidence is recorded")
