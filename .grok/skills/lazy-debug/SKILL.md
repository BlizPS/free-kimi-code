---
name: lazy-debug
description: Use when code crashes, hangs, returns wrong output, fails tests, regresses, or breaks an integration with an unclear root cause.
metadata:
  version: "1.0.0"
---
`RESEARCH → REPRODUCE → LOCALIZE → DISCRIMINATE → FIX → RECHECK`

Search when current/version facts matter. Reproduce the smallest signal; trace **input → boundary → output** to the **first divergence**. Keep few hypotheses; choose high-information checks.

Fix root cause with the narrowest repo-native patch. Avoid speculative retries, sleeps, dependency swaps, or rewrites. Rerun the reproducer + regression proof; report evidence/uncertainty.
