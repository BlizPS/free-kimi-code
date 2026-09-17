# Compatibility

Lazy Developer uses the open Agent Skills shape: one skill folder with `SKILL.md`, plus optional `agents/`, `references/`, and assets. The source of truth is `skills/`.

| Client / surface | Install or discovery | Status |
|---|---|---|
| Agent Skills | `skills/` | Portable baseline |
| GitHub `gh skill` / Skills CLI | repository root `skills/` | Universal installer |
| Claude Code | `.claude-plugin/` marketplace + plugin `skills/` | Native plugin |
| Codex | `.codex-plugin/` + `.agents/plugins/marketplace.json` | Native plugin |
| Cursor | `.cursor-plugin/` marketplace + plugin `skills/` | Native plugin |
| Gemini CLI | `gemini-extension.json` + `skills/` or `.agents/skills/` | Native extension / skills |
| Blackbox CLI | `.blackbox/skills/` | Native project skills |
| Qoder | `.qoder/skills/` | Native project skills |
| Kiro | `.kiro/skills/` | Native project skills |
| OpenCode | `.opencode/skills/` / `.agents/skills/` | Native skill paths |
| OpenClaw | `skills/` / `.agents/skills` + plugin manifest | Native skills/plugin surface |
| GitHub Copilot / other Agent Skills clients | `.agents/skills/` or their documented installer | Compatible baseline |

`npx skills add BlizPS/lazy-developer-skill --all` and `gh skill install BlizPS/lazy-developer-skill --all` are the preferred broad install paths. Client-specific plugin/extension commands are documented only where the client defines them.

Skills speak in actions, not vendor-specific tool names. Harness-specific tool mapping belongs to the host runtime, which keeps the core four skills portable. This follows the multi-harness approach used by projects such as Superpowers.

Run `python3 scripts/doctor.py`, `python3 scripts/style_scan.py`, and `python3 scripts/sync_skills.py --check` before publishing.
