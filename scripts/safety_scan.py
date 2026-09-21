#!/usr/bin/env python3
"""Scan runtime payloads for unsafe directives or hidden egress/exec patterns.

Verification scripts under scripts/ are test harnesses, not runtime payloads.
They may legitimately use subprocesses to exercise installer/CLI behavior, so
the executable-call policy is applied only to actual runtime Python modules.
"""

from pathlib import Path
import ast
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

# Runtime text that can be injected into an agent session.
RUNTIME_FILES = (
    list(ROOT.glob("skills/*/SKILL.md"))
    + list(ROOT.glob("hooks/*.mjs"))
    + list(ROOT.glob("skills/*/agents/openai.yaml"))
    + list(ROOT.glob("skills/*/references/*.md"))
)

# Python modules that are actual runtime code rather than smoke/audit harnesses.
RUNTIME_PYTHON = {
    ROOT / "hooks" / "lazydev-artifact-router.py",
    ROOT / "hooks" / "lazydev-fs-guard.py",
    ROOT / "hooks" / "lazydev-path-guard.py",
    ROOT / "hooks" / "lazydev-prompt-context.py",
    ROOT / "hooks" / "lazydev-research-gate.py",
    ROOT / "hooks" / "lazydev-shell-guard.py",
    ROOT / "hooks" / "lazydev-ui-audit.py",
    ROOT / "runtime" / "artifact_router.py",
    ROOT / "runtime" / "browser-mcp.py",
    ROOT / "runtime" / "filesystem_policy.py",
    ROOT / "runtime" / "platform_paths.py",
    ROOT / "runtime" / "ui_artifact_policy.py",
}

FORBIDDEN_TEXT = [
    "ignore previous instructions", "system prompt", "disable security",
    "exfiltrate", "rm -rf", "powershell -enc", "bypass ai detector",
    "evade ai detector", "defeat ai detector", "change writing to pass an ai detector",
]
FORBIDDEN_RE = [r"\bsudo\s", r"\bcurl\s", r"\bwget\s", r"\bnc\s"]


def fail(msg):
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def scan_text(path: Path) -> None:
    text = path.read_text(encoding="utf-8", errors="strict")
    low = text.lower()
    for needle in FORBIDDEN_TEXT:
        if needle in low:
            fail(f"unsafe runtime text in {path.relative_to(ROOT)}: {needle}")
    for pattern in FORBIDDEN_RE:
        if re.search(pattern, low):
            fail(f"unsafe command text in {path.relative_to(ROOT)}: {pattern}")
    return text


for p in RUNTIME_FILES:
    scan_text(p)

for p in sorted(RUNTIME_PYTHON):
    if not p.is_file():
        continue
    text = scan_text(p)
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

print(
    f"PASS: scanned {len(RUNTIME_FILES)} runtime text files and "
    f"{len([p for p in RUNTIME_PYTHON if p.is_file()])} runtime Python modules "
    "for unsafe directives and hidden exec/egress patterns"
)
