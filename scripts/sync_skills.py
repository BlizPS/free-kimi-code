#!/usr/bin/env python3
"""Verify the single-source skill layout; vendor skill copies are intentionally absent."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
SKILLS=['lazy-developer','lazy-debug','lazy-review','lazy-test']
LEGACY=['.agents/skills','.claude/skills','.codex/skills','.cursor/skills','.devin/skills','.grok/skills','.kiro/skills','.opencode/skills','.qoder/skills','.github/skills','.gemini/skills','.blackbox/skills','plugins/lazy-developer']
errors=[]
for s in SKILLS:
    if not (ROOT/'skills'/s/'SKILL.md').is_file(): errors.append(f'missing skills/{s}/SKILL.md')
for rel in LEGACY:
    if (ROOT/rel).exists(): errors.append(f'legacy duplicated tree remains: {rel}')
if errors:
    print('FAIL'); print('\n'.join('- '+x for x in errors)); sys.exit(1)
print('PASS: single source of truth under skills/; no duplicated vendor skill trees')
