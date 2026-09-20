# Contributing

Keep changes focused and edit the canonical source under `skills/`; do not create vendor-specific skill copies.

Read the relevant code before editing, follow local conventions, avoid unnecessary dependencies and rewrites, and verify behavior before opening a pull request.

Run the deterministic gates before submitting:

```bash
python3 scripts/check_skills.py
python3 scripts/token_budget.py
python3 scripts/eval_skills.py
python3 scripts/compat_smoke.py
python3 scripts/style_scan.py
python3 scripts/safety_scan.py
python3 scripts/validate.py
python3 scripts/sync_skills.py --check
```
