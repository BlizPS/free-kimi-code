#!/usr/bin/env python3
"""Static skill contract/economy gate; it does not benchmark model behavior."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "tests/skill-evals.json").read_text(encoding="utf-8"))
SOURCE = ROOT / "skills"
errors = []

def approx_tokens(text: str) -> int:
    return len(text) // 4

def front(text: str):
    m = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not m:
        return "", ""
    block = m.group(1)
    name = re.search(r"^name:\s*(\S+)\s*$", block, re.M)
    desc = re.search(r"^description:\s*(.+)$", block, re.M)
    return name.group(1) if name else "", desc.group(1).strip() if desc else ""

rows = []
for p in sorted(SOURCE.glob("*/SKILL.md")):
    text = p.read_text(encoding="utf-8")
    name, desc = front(text)
    expected = p.parent.name
    if name != expected:
        errors.append(f"{expected}: frontmatter name mismatch")
    if len(desc) > 360:
        errors.append(f"{expected}: discovery description is too long ({len(desc)} chars)")
    if "version: \"1.0.0\"" not in text:
        errors.append(f"{expected}: missing skill metadata version 1.0.0")
    rows.append((expected, approx_tokens(text), DATA["baseline_by_skill"].get(expected, 0)))

required = DATA["required"]
for skill, signals in required.items():
    p = SOURCE / skill / "SKILL.md"
    text = p.read_text(encoding="utf-8").lower() if p.is_file() else ""
    for signal in signals:
        if signal.lower() not in text:
            errors.append(f"{skill}: missing contract signal: {signal}")

for case in DATA["pressure_cases"]:
    p = SOURCE / case["skill"] / "SKILL.md"
    text = p.read_text(encoding="utf-8").lower() if p.is_file() else ""
    missing = [s for s in case["signals"] if s.lower() not in text]
    if missing:
        errors.append(f"pressure:{case['id']}: missing {', '.join(missing)}")

for case in DATA.get("routing_cases", []):
    p = SOURCE / case["skill"] / "SKILL.md"
    text = p.read_text(encoding="utf-8") if p.is_file() else ""
    desc = front(text)[1].lower()
    missing = [s for s in case["signals"] if s.lower() not in desc]
    if missing:
        errors.append(f"route:{case['id']}: description missing {', '.join(missing)}")

# Cheap guard against process-summary bloat in discovery descriptions.
flow = re.compile(r"(?:RESEARCH|UNDERSTAND|ACT|VERIFY|SHIP)\s*→")
for name, _, _ in rows:
    desc = front((SOURCE / name / "SKILL.md").read_text(encoding="utf-8"))[1]
    if flow.search(desc):
        errors.append(f"{name}: description contains workflow steps; keep routing metadata trigger-focused")

total = sum(n for _, n, _ in rows)
baseline = DATA["baseline_approx_tokens"]
limit = DATA["max_approx_tokens"]
reduction = (1 - total / baseline) * 100
print("skill-eval v2")
for name, tokens, base in rows:
    print(f"  {name}: ~{tokens} tokens (orig ~{base}; {tokens/base*100:.1f}%)")
print(f"  total: ~{total}; baseline: ~{baseline}; reduction: {reduction:.1f}%")
print(f"  limit: ~{limit}")
if total > limit:
    errors.append(f"source skills exceed total hot-path budget: {total} > {limit}")
for name, tokens, base in rows:
    if base and tokens / base > DATA["max_fraction"]:
        errors.append(f"{name}: exceeds per-skill fraction {DATA['max_fraction']:.2f} ({tokens}/{base})")
if errors:
    print("\nFAIL")
    print("\n".join(f"- {e}" for e in errors))
    return_code = 1
else:
    print("PASS")
    return_code = 0
sys.exit(return_code)
