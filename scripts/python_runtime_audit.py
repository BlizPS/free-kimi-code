#!/usr/bin/env python3
from __future__ import annotations

import ast
import compileall
import importlib.util
import os
import platform
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

if not compileall.compile_dir(str(ROOT / "cli"), quiet=1, force=True):
    errors.append("cli Python compilation failed")
for directory in (ROOT / "hooks", ROOT / "scripts"):
    for path in directory.glob("*.py"):
        if not compileall.compile_file(str(path), quiet=1, force=True):
            errors.append(f"Python compilation failed: {path.relative_to(ROOT)}")

source = ROOT / "cli" / "lazydev.py"
tree = ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
functions = {node.name for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
for required in {"chat", "setup", "detect_languages", "write_kimi_files", "refresh_selected_model"}:
    if required not in functions:
        errors.append(f"missing native CLI function: {required}")

for path in ROOT.glob("skills/*/SKILL.md"):
    text = path.read_text(encoding="utf-8")
    if 'version: "1.0.0"' not in text:
        errors.append(f"skill version drift: {path.relative_to(ROOT)}")

expected = {"lazy-developer", "lazy-debug", "lazy-review", "lazy-test"}
actual = {p.name for p in (ROOT / "skills").iterdir() if p.is_dir()}
if actual != expected:
    errors.append(f"skill set drift: {sorted(actual)}")

print(f"Python audit · {platform.system()} {platform.machine()} · Python {platform.python_version()}")
if errors:
    print("FAIL")
    print("\n".join(f"- {item}" for item in errors))
    raise SystemExit(1)
print("PASS: native CLI, hooks, skills, and Python runtime structure compile and match the LazyDev contract")
