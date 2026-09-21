# Free Kimi Code — Getting Started

Free Kimi Code is a free, open-source developer layer for Kimi Code, Codex CLI, Antigravity CLI, and Claude Code. It keeps the native terminal interfaces and adds shared Lazy Developer skills, model routing, context optimization, MCP tooling, safe artifacts, and developer workflow controls.

## Install

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.ps1")))
```

## First run

```sh
lazydev setup
lazydev chat
lazydev doctor
```

`lazydev setup` is the source of truth for the providers and models currently available to the installation. The project intentionally avoids a hard-coded provider list because the catalog can change over time.

## Native CLI model

Free Kimi Code does not replace Kimi Code, Codex, Antigravity, or Claude Code with a custom terminal UI. `lazydev chat` discovers installed native clients and opens the selected workflow.

## Universal skills

```sh
npx skills add BlizPS/free-kimi-code --all
```

The bundled skills are `lazy-developer`, `lazy-debug`, `lazy-review`, and `lazy-test`.

## Upgrade

Re-run the installer, then check:

```sh
lazydev version
lazydev doctor
```

Native client sessions and configuration remain in their native locations.
