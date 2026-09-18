<div align="center">

# 🦥 Lazy Developer

<img src="assets/image.jpg" alt="Lazy Developer" />

[![Version](https://img.shields.io/badge/version-1.0.0-6f42c1)](https://github.com/BlizPS/lazy-developer-free-kimi-code/releases)
[![CI](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/ci.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/ci.yml)
[![Validate](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/validate.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/validate.yml)
[![Stars](https://img.shields.io/github/stars/BlizPS/lazy-developer-free-kimi-code?style=flat)](https://github.com/BlizPS/lazy-developer-free-kimi-code/stargazers)
[![Forks](https://img.shields.io/github/forks/BlizPS/lazy-developer-free-kimi-code?style=flat)](https://github.com/BlizPS/lazy-developer-free-kimi-code/network/members)
[![License](https://img.shields.io/badge/license-MIT-111111)](LICENSE)

**A relaxed coding setup for Kimi Code — with better skills, smarter defaults, and less terminal noise.**

</div>


Lazy Developer keeps the workflow simple: install the tools, choose the provider you actually want to use, then start Kimi Code. The provider menu is live, so the model list comes from the service instead of a stale hard-coded list.

```text
install → setup → chat
```

## Get started

### 1. Install or update

On desktop, the installer handles the whole setup for you: **Kimi Code 2.0.0**, **RTK**, and **Lazy Developer 1.0.0**. It does not require npm.

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

Run the same installer again whenever you want to update. It checks Kimi Code, RTK, and Lazy Developer separately, so unchanged pieces are skipped. A newer compatible Kimi Code installation is also left alone instead of being downloaded again. Lazy Developer updates are keyed to the GitHub revision, so the project can stay at version 1.0.0 while its source changes. Your Kimi sessions and provider configuration stay in place during updates.

**Termux / Android:** use a Linux userland first. Native Android/bionic Termux is not a supported host for the Linux Kimi/RTK binaries. A minimal setup is:

```bash
pkg update
pkg install proot-distro
proot-distro install debian
proot-distro login debian
```

Run the normal Lazy Developer installer from that Linux shell. The runtime also recognizes the Android/Termux host bindings that remain visible inside proot-distro even though the guest environment is rebuilt, so standalone artifacts still go to `/storage/emulated/0/lazydevfile`. Native Linux keeps its normal `$HOME/lazydevfile` path unchanged. The installer detects glibc Linux inside Termux and places the `lazydev` launcher in the active Termux PATH when appropriate. This also repairs an older broken `lazydev` symlink in `$PREFIX/bin`, so `lazydev setup` resolves to the current build instead of a missing old target.

### 2. Set up your provider

Before the first chat, run:

```bash
lazydev setup
```

Pick a provider, authenticate it, and choose one of the models returned by the provider's live catalog. There are now **9 provider options** in the setup screen:

1. **OpenRouter** — API key + live model catalog
2. **Gemini** — API key + live model catalog
3. **NVIDIA** — API key + live model catalog
4. **OpenAI** — API key + live model catalog
5. **Ollama Local** — local API URL + live models from your running Ollama instance
6. **LLM7** — API key + live model catalog
7. **Groq** — API key + live model catalog
8. **CodeBuddy** — API key + live model catalog
9. **Anthropic** — API key + live model catalog

Standalone artifacts use the platform-specific `lazydevfile` directory. Native Linux keeps `$HOME/lazydevfile`; Termux, including Debian/Ubuntu guests launched through proot-distro, uses `/storage/emulated/0/lazydevfile`. File creation never overwrites an existing standalone artifact: a collision such as `report.html` becomes `report1.html`, then `report2.html`, and so on.

Ollama is the only provider that does not ask for an API key. Give Lazy Developer the address of the local Ollama API, it checks the endpoint, reads the models that are actually running there, and uses the selected local model. Your inference still happens on your own Ollama machine; Lazy Developer and RTK remain in the workflow around Kimi Code.

### 3. Start coding

Once setup finishes, start the real coding session with:

```bash
lazydev chat
```

Bare `lazydev` opens the Lazy Developer command center. `lazydev chat` is the entry point that launches Kimi Code.

## Kimi Code login/logout without losing LazyDev routing

Native Kimi Code `/login` and `/logout` remain available inside the TUI. Lazy Developer does not fake these commands and does not replace Kimi Code's authentication flow. Each session gets a `KIMI_MODEL_*` runtime override that pins inference to the provider/model selected in `lazydev setup`, so an OAuth login or logout cannot leave the session at `Model: not set` or silently switch inference to the managed Kimi account. Google Gemini uses its documented OpenAI-compatible endpoint for this runtime override.

Lazy Developer also runs a small auth bridge while the Kimi session is alive. When `/login` or `/logout` reloads `config.toml`, the bridge restores the LazyDev provider/model aliases and `default_model` while preserving unrelated Kimi authentication sections that the native flow just wrote. This keeps both sides independent: Kimi can authenticate or disconnect its own account, while LazyDev keeps the selected inference route.

The OAuth credentials still live in Kimi Code's normal `KIMI_CODE_HOME` credential store. Kimi Code documents `KIMI_CODE_HOME` as the root for configuration, sessions, OAuth credentials, and other runtime data.

This is an inference-routing safeguard, not a claim that Kimi Code authentication grants access to any third-party provider or model. Provider API keys and model selection remain controlled by LazyDev setup.

## Switching models without breaking old sessions

Lazy Developer keeps the conversation history in Kimi Code's session store and refreshes the active model mapping each time `lazydev chat` starts. When an older session refers to a previous LazyDev model alias, the runtime adds a compatibility alias that points to the currently selected provider/model instead of editing or deleting the saved session. That keeps old conversation context while letting the session continue on the model you selected now. Kimi Code stores session context and runtime state separately from `config.toml`, so this compatibility layer only changes the launch-time model mapping.

## Web search with third-party models

Kimi Code's built-in `WebSearch` is host-provided and is only available when its search service is configured. Lazy Developer therefore adds a small local `search_web` MCP server for providers that do not expose Kimi's managed search service. If native `WebSearch` is available, it is preferred; otherwise the model can use the LazyDev search tool without changing providers.

## Live models, not a frozen list

Lazy Developer asks each provider for its current model catalog during setup. OpenRouter exposes a models endpoint, Gemini exposes `models.list`, Groq exposes `/openai/v1/models`, and LLM7 provides an OpenAI-compatible `/v1/models` endpoint. Ollama is handled locally through its running API instead of a cloud catalog.

OpenAI setup now uses a bounded request with an explicit timeout. A slow or unreachable `/v1/models` request fails cleanly instead of leaving the terminal sitting forever on `loading live models`.

CodeBuddy supports API-key authentication and model configuration through its CLI ecosystem; Lazy Developer treats it as an OpenAI-compatible provider and tries the public model catalog first, with a compatible fallback endpoint when available. Provider-side endpoints can change, so a failed CodeBuddy catalog refresh is surfaced instead of silently inventing models.

## RTK, already wired in

The desktop installer also installs **Rust Token Killer (RTK)** and connects it to Kimi Code. RTK filters noisy command output before it reaches the agent; its upstream project describes **up to 90% fewer terminal-output tokens** for supported output. That is terminal-output reduction, not a promise that every conversation or provider bill drops by the same percentage.

If RTK is already current, the installer skips it. If it is missing or unhealthy, it installs or repairs it.

## Skills without the bloat

Lazy Developer bundles focused skills for implementation, debugging, review, and testing. Kimi Code is pointed at the bundled skill directory when a session starts, and the runtime enables the skill merge path so the skills are available without duplicating a huge instruction block into every project.

Local token-budget checks measure the packaged skill payload rather than billing. Current measurements are above the project's 75% reduction target on the tested hot paths; real prompt savings still depend on the task, conversation history, tools, and provider.

## Use the skills with other CLIs

Lazy Developer is also a portable skill/plugin package. When another agent supports the standard Skills CLI, you can install the same repository into that agent or project:

```bash
npx skills add BlizPS/lazy-developer-free-kimi-code --all
```

That universal path is separate from the `lazydev` CLI. You do not need it for `lazydev chat`; Lazy Developer already wires its own bundled skills.

The repository also includes plugin/integration metadata for other agent ecosystems, so the same skill layer can travel with you instead of being locked to one front end.

## Updating

There is no separate updater command. Run the normal platform installer again:

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

The installer is component-aware:

- Kimi Code unchanged → skipped.
- RTK unchanged → skipped.
- Lazy Developer at the same GitHub revision and healthy → skipped.
- Anything changed, missing, or unhealthy → refreshed.

Updating Lazy Developer does not wipe Kimi sessions or saved provider configuration.

## Uninstall everything

For a clean removal, use the matching uninstaller. It is deliberately broader than an update: it removes the managed Lazy Developer installation, Kimi Code, RTK, LazyDev configuration, managed caches, launchers, and related generated files.

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.ps1")))
```

A fresh install after uninstall starts from a clean state. Project folders outside Lazy Developer's managed locations are left alone.

## Troubleshooting

If a provider refresh appears to hang, the live catalog request now has a hard timeout. Rerun `lazydev setup` and try the provider again. For a local Ollama setup, first make sure the URL you entered is reachable from the same machine and that Ollama is serving models.

If Kimi Code reports `[provider.api_error] Error: Invalid URL`, this is usually a provider endpoint problem rather than a model-name problem. Lazy Developer validates every endpoint before starting the session, writes the OpenAI provider to the official `https://api.openai.com/v1` endpoint, and prevents stale `OPENAI_BASE_URL`, Gemini, or Anthropic URL overrides from replacing the session configuration. Run the installer again, then run `lazydev setup` and select the provider once more.

The desktop installer prefers a writable directory that is already on the current `PATH`, so a one-line `curl | sh` install can use `lazydev` immediately. It also repairs stale LazyDev launchers and broken symlinks left by older installs. If no writable `PATH` directory exists, it falls back to `~/.local/bin` and prints the exact `export PATH=...` command needed for the current shell.

## Project

Source: https://github.com/BlizPS/lazy-developer-free-kimi-code

Issues: https://github.com/BlizPS/lazy-developer-free-kimi-code/issues

## Development

Repository metadata is kept for package tooling and CI, but normal desktop installation does not require npm.

From the repository root:

```bash
npm test
```

## License

MIT

> **Version note:** Lazy Developer stays at **1.0.0**. Kimi Code's own version is controlled by the Kimi Code release you install; Lazy Developer does not rewrite or spoof Kimi's binary version. The managed installer pins the compatible Kimi release and disables Kimi's automatic self-upgrade so it does not silently move to a different upstream version.
