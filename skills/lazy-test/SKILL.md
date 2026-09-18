---
name: lazy-test
description: Use to verify code, UI, runtime behavior, releases, and packaging with the smallest proof.
metadata:
  version: "1.0.0"
---
# Lazy Test

**PROOF → RUN → INTERPRET → STOP/EXPAND.**

- Rank by **risk**, **fan-out**, and impact; run the smallest checks covering the changed contract. Expand after failure or untested risk.
- UI changes need rendered/responsive proof. `lint ≠ runtime`; `build ≠ behavior`; `skipped ≠ passed`.
- **Anti-yap:** report `result → coverage` plus remaining risk. Never claim an unrun check passed.
