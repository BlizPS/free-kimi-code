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
- Add **regression** proof. No blind retries or speculative rewrites.
- **Anti-yap:** target ~75% less avoidable prose; report **cause → fix → proof → caveat** only when each adds information; no **theory dump**.

