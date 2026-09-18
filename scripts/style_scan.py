#!/usr/bin/env python3
"""Static prose-quality gate; checks project-native style, not authorship or detector evasion."""
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
TARGETS=[ROOT/"README.md", ROOT/"COMPATIBILITY.md", ROOT/"AGENTS.md", ROOT/"CLAUDE.md", ROOT/"GEMINI.md"]
TARGETS += sorted((ROOT/"skills").glob("*/SKILL.md"))
FORBIDDEN=[
    r"\bas an ai\b", r"\bdear user\b", r"\bleveraging\b", r"\bcutting[- ]edge\b",
    r"\bin conclusion\b", r"\bwithout further ado\b", r"\bi hope this helps\b",
]
errors=[]
for p in TARGETS:
    if not p.exists():
        errors.append(f"missing: {p.relative_to(ROOT)}"); continue
    text=p.read_text(encoding='utf-8')
    low=text.lower()
    for pat in FORBIDDEN:
        if re.search(pat, low): errors.append(f"{p.relative_to(ROOT)}: generic boilerplate: {pat}")
    lines=[re.sub(r"\s+", " ", x.strip().lower()) for x in text.splitlines() if x.strip() and not x.startswith('```')]
    counts={}
    for line in lines: counts[line]=counts.get(line,0)+1
    dup=[(x,n) for x,n in counts.items() if n>2 and len(x)>40]
    if dup: errors.append(f"{p.relative_to(ROOT)}: repeated prose line(s) {len(dup)}")
if errors:
    print("FAIL")
    print("\n".join(errors)); sys.exit(1)
print(f"PASS: style scan ({len(TARGETS)} canonical text files); naturalness is heuristic, not authorship proof")
