---
name: lazy-review
description: Use for diffs, security changes, generated code, regressions, and audits needing actionable findings.
metadata:
  version: "1.0.0"
---
# Lazy Review

**SCOPE → TRACE → CHALLENGE → PROVE → REPORT.**

- Start at changed files; expand only through proven dependencies. Trace input → validation → state → sink/output.
- Challenge schema drift, auth, injection, stale state, resource leaks, error paths, compatibility, and regressions.
- Finding = **path+evidence+impact + fix**. **style ≠ finding**.
- **Lead with findings**. Skip **generic praise**. If none: `No actionable findings.`
