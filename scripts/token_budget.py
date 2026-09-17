#!/usr/bin/env python3
"""Fail-fast token budget for source SKILL.md files (chars / 4 heuristic)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "skills"
BUDGETS = {
    "lazy-developer": 400,
    "lazy-debug": 160,
    "lazy-review": 170,
    "lazy-test": 150,
}

def approx_tokens(text: str) -> int:
    return len(text) // 4

def main():
    rows, bad = [], []
    for p in sorted(SOURCE_ROOT.glob("*/SKILL.md")):
        tokens = approx_tokens(p.read_text(encoding="utf-8"))
        budget = BUDGETS.get(p.parent.name, 0)
        rows.append((p.parent.name, tokens, budget))
        if not budget or tokens > budget:
            bad.append((p.parent.name, tokens, budget))
    print(f"{'skill':<20}{'~tokens':>8}{'budget':>8}")
    for name, tokens, budget in rows:
        print(f"{name:<20}{tokens:>8}{budget:>8}")
    if bad:
        print("\nFAIL: budget drift")
        for name, tokens, budget in bad:
            print(f"- {name}: {tokens} > {budget}")
        return 1
    print("\nPASS: all source skills fit their hot-path budgets")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
