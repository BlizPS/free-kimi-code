# Free Kimi Code — Lazy Developer Skills

Free Kimi Code ships four small, reusable skills:

- `lazy-developer`
- `lazy-debug`
- `lazy-review`
- `lazy-test`

## Shared skill layout

The canonical source is `skills/`. LazyDev also prepares native user discovery paths so the same skills can be used across Kimi Code, Codex, Antigravity, and Claude Code.

Claude Code receives per-skill links under `~/.claude/skills/`; the directory itself is never replaced, so existing personal skills remain intact.

## Verify

```sh
lazydev skills
lazydev doctor
```

The goal is one skill source with native discovery on every supported CLI, rather than maintaining four drifting copies.
