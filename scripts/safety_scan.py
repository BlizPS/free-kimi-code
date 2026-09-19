#!/usr/bin/env python3
"""Scan runtime skill payloads for unsafe directives or hidden egress/exec patterns."""
from pathlib import Path
import ast
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_FILES = list(ROOT.glob("skills/*/SKILL.md")) + list(ROOT.glob("hooks/*.mjs")) + list(ROOT.glob("skills/*/agents/openai.yaml"))
RUNTIME_FILES += list(ROOT.glob("skills/*/references/*.md"))
RUNTIME_FILES += [p for p in ROOT.glob("scripts/*.py") if p.name not in {"safety_scan.py"}]

FORBIDDEN_TEXT = [
    "ignore previous instructions", "system prompt", "disable security",
    "exfiltrate", "rm -rf", "powershell -enc", "bypass ai detector",
    "evade ai detector", "defeat ai detector", "change writing to pass an ai detector",
]
FORBIDDEN_RE = [r"\bsudo\s", r"\bcurl\s", r"\bwget\s", r"\bnc\s"]

def fail(msg):
    print(f"FAIL: {msg}")
    raise SystemExit(1)

for p in RUNTIME_FILES:
    text = p.read_text(encoding="utf-8", errors="strict")
    low = text.lower()
    for needle in FORBIDDEN_TEXT:
        if needle in low:
            fail(f"unsafe runtime text in {p.relative_to(ROOT)}: {needle}")
    for pattern in FORBIDDEN_RE:
        if re.search(pattern, low):
            fail(f"unsafe command text in {p.relative_to(ROOT)}: {pattern}")
    if p.suffix == ".py":
        try:
            tree = ast.parse(text)
        except SyntaxError as e:
            fail(f"syntax error in {p.relative_to(ROOT)}: {e}")
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                    if node.func.value.id == "subprocess":
                        fail(f"subprocess call in runtime script {p.relative_to(ROOT)}")
                    if node.func.value.id == "os" and node.func.attr in {"system", "popen"}:
                        fail(f"os.{node.func.attr} in runtime script {p.relative_to(ROOT)}")

print(f"PASS: scanned {len(RUNTIME_FILES)} runtime text/script files for unsafe directives and hidden exec/egress patterns")
