---
name: lazy-test
description: Use to verify code, UI, runtime behavior, releases, and packaging with the smallest proof.
metadata:
  version: "1.0.0"
---
# Lazy Test

**PROOF → RUN → INTERPRET → STOP/EXPAND.**

- Rank by **risk**, **fan-out**, impact; run smallest checks covering changed contract. Expand after failure/untested risk.
- UI changes need rendered/responsive proof. `lint ≠ runtime`; `build ≠ behavior`; `skipped ≠ passed`.
- **Anti-yap:** target ~75% less prose; report `result → coverage` plus risk.

