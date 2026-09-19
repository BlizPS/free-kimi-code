---
name: lazy-review
description: Use for diffs, security changes, generated code, regressions, and audits needing actionable findings.
metadata:
  version: "1.0.0"
---
# Lazy Review

**SCOPE → TRACE → CHALLENGE → PROVE → REPORT.**

- Start at changed files; expand through dependencies. Trace input → validation → state → sink/output.
- Challenge schema drift, auth, injection, leaks, error paths, compatibility.
- Finding = **path+evidence+impact + fix**. **style ≠ finding**.
- **Lead with findings**. Target ~75% less avoidable prose; skip **generic praise** and restatement. If none: `No actionable findings.`

