<div align="center">

# 🦥 Lazy Developer

<img src="assets/image.jpg" alt="Lazy Developer" />

[![Version](https://img.shields.io/badge/version-1.0.0-6f42c1)](#) [![CI](https://github.com/BlizPS/lazy-developer-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-skill/actions/workflows/validate.yml)

**Lazy about talking. Relentless about shipping.**

Four execution-first Agent Skills for developers who want less AI slop,
less wasted context, and more actual engineering — packed for progressive, on-demand loading.

</div>

---

## The idea

Most coding agents spend too many tokens talking about the work.

**Lazy Developer** flips the priority:

> understand → secure → act → verify → ship

**Lazy Review** uses the same mindset for code review:

> scope → trace → check → report

Less ceremony. More signal.

---

## Skills

### Lazy Developer
The execution skill. Build, debug, refactor, modify, and package real projects with low ceremony, security awareness, project-native code, and verification before shipping.

### Lazy Review
The review skill. Inspect the relevant surface, trace behavior, find evidence-backed bugs and security issues, and report only findings worth acting on.

### Lazy Debug
The debugging skill. Reproduce the failure, narrow the executed path, prove the root cause, make the smallest fix, and recheck it. It avoids guess-and-check loops and unnecessary diagnostic noise.

### Lazy Test
The verification skill. Pick the cheapest checks that actually prove the changed behavior, run them, read what they prove, and stop when the risk is covered.

### Built-in document hygiene
`lazy-developer` also contains an owned-content document hygiene path for supported text and document formats. It preserves meaning, facts, names, identifiers, and structure while cleaning only clearly non-semantic metadata or formatting residue. It is **not** an authorship claim and is not intended to manipulate detector scores.

---

Together, the four skills form a small workflow:

> UNDERSTAND → SECURE → ACT → DEBUG → TEST → REVIEW → SHIP

Each skill is independently usable — use only the one that matches the work. The source skills are kept compact; references and deterministic checks stay outside the hot path.

---

## What "lazy" means

Lazy does not mean careless.

It means the agent should be lazy about:

- repeating the request
- narrating obvious steps
- printing unchanged code
- giving five alternatives when one is enough
- adding architecture nobody asked for
- producing generic review comments
- explaining work that can simply be done

It should never be lazy about:

- correctness
- security
- requirements
- relevant edge cases
- verification
- evidence

---

## Installation

Recommended universal install (project scope):

```bash
npx skills add BlizPS/lazy-developer-skill --all
```

Or target a specific agent:

```bash
npx skills add BlizPS/lazy-developer-skill --skill '*' -a claude-code
```

GitHub CLI can install the same source to supported coding agents:

```bash
gh skill install BlizPS/lazy-developer-skill --all
```

Claude Code plugin marketplace:

```text
/plugin marketplace add BlizPS/lazy-developer-skill
/plugin install lazy-developer@lazy-developer-marketplace
```

Codex marketplace (from a local clone):

```bash
codex plugin marketplace add .
codex plugin add lazy-developer@blizps
```

OpenCode can consume the same skills through the Agent Skills paths or the universal installer; use its native skill tool after install.

Native paths are bundled for Codex/Claude/Cursor/Gemini/Blackbox/OpenCode/Qoder/Kiro and other Agent Skills clients.
For Gemini extension install, use `gemini extensions install https://github.com/BlizPS/lazy-developer-skill`; for most other clients, prefer the documented native installer or `npx skills`/`gh skill`.

Keep the skills in the standard Agent Skills layout:

```
skills/
├── lazy-developer/
│   └── SKILL.md
├── lazy-review/
│   └── SKILL.md
├── lazy-debug/
│   └── SKILL.md
└── lazy-test/
    └── SKILL.md
```

The skills are independent. Use `lazy-developer` for implementation work and `lazy-review` when you want a focused review of existing code or a change.

---

## Package layout

```
skills/
├── lazy-developer/SKILL.md
├── lazy-review/SKILL.md
├── lazy-debug/SKILL.md
└── lazy-test/SKILL.md

AGENTS.md
gemini-extension.json
SECURITY.md
SUPPORT.md
scripts/
├── validate.py
├── check_skills.py
├── sync_skills.py
└── token_budget.py
```

Edit only the source files under `skills/`, then run `python3 scripts/sync_skills.py` to
propagate the change to every platform mirror. Run `python3 scripts/token_budget.py`, `python3 scripts/doctor.py`,
`python3 scripts/eval_skills.py`, `python3 scripts/compat_smoke.py`, `python3 scripts/style_scan.py`, and `python3 scripts/validate.py`; CI runs the same gates
on every push. The compact skill hot-path is intentionally budgeted to stay at or below one quarter of the original source size.

The package includes the portable Agent Skills layout plus native discovery paths and plugin/extension entry points where those clients document them. Unknown vendor behavior is not guessed. No vendor-specific feature is assumed when that client does not document it.

---

## License

MIT — see [LICENSE](LICENSE)

Modify, adapt, and redistribute freely.

---

<div align="center">

⭐ **Like it? Star it.**

*Less talk More signal*

</div>
