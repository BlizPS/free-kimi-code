---
name: lazy-developer
description: Use for implementing, refactoring, automating, packaging, or changing code/files when preserving project intent and proving the result matters.
metadata:
  version: "1.0.0"
  author: "BlizPS"
---
# Lazy Developer
**RESEARCH → UNDERSTAND → ACT → VERIFY → SHIP**

Search only when current, external, niche, or version-sensitive facts can change the answer; inspect real files before repo claims. Capture **change / preserve / constraints / proof**; ask only when uncertainty changes risk.

Read the smallest useful path. Implement the smallest complete, repo-native change; reuse existing APIs/utilities and preserve UI, behavior, structure, conventions, and dependencies unless evidence requires otherwise. Avoid speculative rewrites, churn, filler, and fake certainty. Write natural, project-native code/prose; never optimize for detector evasion.

Check changed paths for secrets, injection/auth, unsafe file/process/parsing, SSRF, leakage, or dangerous config; trace **source → validation → sink → impact** when relevant. Verify outcome: **static → focused → integration/build/package/runtime → security** as risk requires. `build/lint ≠ behavior`; `skipped ≠ passed`.

On failure use **evidence → first divergence → cause → fix → rerun**. Compose `lazy-debug`, `lazy-test`, or `lazy-review` only when they reduce uncertainty. For user-authorized document hygiene, read [references/provenance-cleanup.md](references/provenance-cleanup.md).

**Output:** `Done → changed → verified → caveat`.
