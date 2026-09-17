#!/usr/bin/env python3
"""Check source skills, mirrors, and their optional Codex UI metadata."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "skills"
MIRROR_ROOTS = ['.agents/skills', '.claude/skills', '.codex/skills', '.cursor/skills', '.devin/skills', '.grok/skills', '.kiro/skills', '.opencode/skills', '.qoder/skills', '.github/skills', '.gemini/skills', '.blackbox/skills', '.agents/plugins/lazy-developer/skills', '.grok/plugins/lazy-developer/skills', 'plugins/lazy-developer/skills']

def read(path):
    return path.read_text(encoding="utf-8")

errors = []
sources = {}
for d in sorted(SOURCE_ROOT.iterdir()):
    if not d.is_dir():
        continue
    p = d / "SKILL.md"
    if not p.is_file():
        errors.append(f"missing source skill: {p.relative_to(ROOT)}")
        continue
    text = read(p)
    if not re.match(r"^---\nname:\s*[^\n]+\ndescription:\s*[^\n]+\n(?:metadata:\n(?:  [^\n]+\n)*)?---\n", text):
        errors.append(f"{d.name}: invalid frontmatter shape")
    if len(text) < 500:
        errors.append(f"{d.name}: suspiciously small skill")
    if 'version: "1.0.0"' not in text:
        errors.append(f"{d.name}: missing metadata version 1.0.0")
    ui = d / "agents/openai.yaml"
    if not ui.is_file():
        errors.append(f"{d.name}: missing agents/openai.yaml")
    sources[d.name] = text

for name, text in sources.items():
    for root in MIRROR_ROOTS:
        target = ROOT / root / name / "SKILL.md"
        if not target.is_file():
            errors.append(f"{name}: missing mirror {target.relative_to(ROOT)}")
        elif read(target) != text:
            errors.append(f"{name}: mirror mismatch {target.relative_to(ROOT)}")
        ui = ROOT / root / name / "agents/openai.yaml"
        src_ui = SOURCE_ROOT / name / "agents/openai.yaml"
        if not ui.is_file():
            errors.append(f"{name}: missing UI metadata {ui.relative_to(ROOT)}")
        elif ui.read_bytes() != src_ui.read_bytes():
            errors.append(f"{name}: UI metadata mismatch {ui.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    raise SystemExit(1)
print(f"PASS: {len(sources)} skills, mirrors, and UI metadata are synchronized")
