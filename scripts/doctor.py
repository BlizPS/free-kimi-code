#!/usr/bin/env python3
"""Local packaging doctor: verify native skill/plugin surfaces without executing agents."""
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ["lazy-developer", "lazy-debug", "lazy-review", "lazy-test"]
errors=[]

def need(rel):
    p=ROOT/rel
    if not p.exists(): errors.append(f"missing {rel}")
    return p

# Portable source: what skills.sh / compatible installers should consume.
for s in SKILLS: need(f"skills/{s}/SKILL.md")

# Native project discovery surfaces.
for rel in [
    '.agents/skills', '.claude/skills', '.codex/skills', '.cursor/skills',
    '.gemini/skills', '.github/skills', '.kiro/skills', '.opencode/skills',
    '.qoder/skills', '.blackbox/skills', '.devin/skills', '.grok/skills',
]:
    need(rel)

# Plugin roots.
for rel in [
    "plugin.json", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
    ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json", ".cursor-plugin/marketplace.json",
    "plugins/lazy-developer/.claude-plugin/plugin.json",
    "plugins/lazy-developer/.codex-plugin/plugin.json",
    "plugins/lazy-developer/.cursor-plugin/plugin.json",
    "openclaw.plugin.json",
    "gemini-extension.json",
]: need(rel)

# Validate all explicit versions.
for p in ROOT.rglob("*.json"):
    if ".git" in p.parts: continue
    try: data=json.loads(p.read_text(encoding="utf-8"))
    except Exception: continue
    if isinstance(data, dict) and "version" in data and data["version"] != "1.0.0":
        errors.append(f"{p.relative_to(ROOT)}: version drift {data['version']!r}")

# Every source-relative markdown reference must resolve within its skill bundle.
for p in (ROOT/"skills").glob("*/SKILL.md"):
    import re
    text=p.read_text(encoding="utf-8")
    for target in re.findall(r"\]\(([^)]+)\)", text):
        if target.startswith(("http://","https://","#","mailto:")): continue
        q=(p.parent/target.split('#',1)[0]).resolve()
        if not str(q).startswith(str(p.parent.resolve())) or not q.exists():
            errors.append(f"{p.relative_to(ROOT)}: broken relative reference {target}")

if errors:
    for e in errors: print("FAIL:",e)
    raise SystemExit(1)
print(f"PASS: native surfaces, plugin manifests, 1.0.0 versions, and skill references are coherent")
