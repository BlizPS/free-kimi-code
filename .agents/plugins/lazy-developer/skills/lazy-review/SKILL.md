---
name: lazy-review
description: Use for diffs, PRs, generated code, security changes, regressions, or audits needing actionable findings.
metadata:
  version: "1.0.0"
---
`RESEARCH → SCOPE → TRACE → CHALLENGE → PROVE → REPORT`

Search when current/external contracts matter. Start changed files; expand via proven deps. Trace **input → validation → state → output**; security: **source → validation → sink → impact**.

Challenge auth/injection, unsafe file/process/deserialization, races, retries, API/schema, stale input, resources. Finding = **path+evidence+impact**; prove high-impact; style ≠ finding.

Report severity/path/impact/fix; else `No actionable findings.`
