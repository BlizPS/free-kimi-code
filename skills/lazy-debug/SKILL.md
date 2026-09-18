---
name: lazy-debug
description: Use for crashes, wrong output, hangs, regressions, or unclear root causes.
metadata:
  version: "1.0.0"
---
# Lazy Debug

**REPRODUCE → DISCRIMINATE → RECHECK.**

- Reproduce the smallest signal; find the **first divergence** with **high-information** checks.
- Trace input → boundary → failure; fix the root cause narrowly and preserve behavior.
- Add **regression** proof. No blind retries, dependency swaps, or speculative rewrites.
- **Anti-yap:** no **theory dump**. Report **cause → fix → proof → caveat**; distinguish skipped from passed.
