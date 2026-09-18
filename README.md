<div align="center">

# 🦥 Lazy Developer

<img src="assets/image.jpg" alt="Lazy Developer" />

[![Version](https://img.shields.io/badge/version-1.0.0-6f42c1)](https://github.com/BlizPS/lazy-developer-skill-cli/releases)
[![CI](https://github.com/BlizPS/lazy-developer-skill-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-skill-cli/actions/workflows/ci.yml)
[![Validate](https://github.com/BlizPS/lazy-developer-skill-cli/actions/workflows/validate.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-skill-cli/actions/workflows/validate.yml)
[![Stars](https://img.shields.io/github/stars/BlizPS/lazy-developer-skill-cli?style=flat)](https://github.com/BlizPS/lazy-developer-skill-cli/stargazers)
[![Forks](https://img.shields.io/github/forks/BlizPS/lazy-developer-skill-cli?style=flat)](https://github.com/BlizPS/lazy-developer-skill-cli/network/members)
[![License](https://img.shields.io/badge/license-MIT-111111)](LICENSE)

**A practical skills, plugin, and agent layer for modern coding CLIs.**

</div>

Lazy Developer is the part of your coding setup that quietly makes everything feel more put together. It bundles engineering skills, project-aware guidance, guardrails, provider routing, and a simple CLI entrypoint — without forcing you to rebuild your workflow around another giant framework.

Use the built-in LazyDev flow when you want the full experience, or take the same skills and integrations into another compatible coding agent.

## Quick start

### 1. Install

The installer handles the setup in one go. You do **not** need to install LazyDev with npm.

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.ps1")))
```

The installer installs or repairs both **Kimi Code 0.43.1** and **Lazy Developer 1.0.0**. Kimi Code is installed through Moonshot's native installer, while LazyDev is installed directly from this GitHub repository. No npm global install is involved in this flow. Kimi Code's official installer is also designed as a native, no-Node prerequisite installation path.

The desktop installer also bootstraps a private Node.js runtime for LazyDev when a compatible Node.js installation is not already available. This keeps the setup self-contained without turning npm into a prerequisite.

> **Termux / Android:** Kimi Code's native installer does not currently publish an Android/Termux build; upstream has an open request for Termux support. The native one-line installer is therefore intended for supported desktop Linux and macOS environments rather than pretending Android is already supported.

### 2. Set up your provider, API key, and model

After installation, configure the AI service LazyDev should use:

```bash
lazydev setup
```

This is the only setup step you need before your first session. Pick a provider, enter its API key, and choose a live model from the provider catalog. Current managed providers include **Gemini, OpenRouter, NVIDIA, Anthropic, and OpenAI**.

### 3. Start coding

Once setup is saved, open the actual coding session with:

```bash
lazydev chat
```

Running `lazydev` on its own opens the Lazy Developer command center. It does **not** start Kimi Code. The normal flow is simply:

```text
Install
  ↓
lazydev setup
  ↓
Provider + API key + model
  ↓
lazydev chat
```

## Why Lazy Developer?

LazyDev is meant to feel like a useful layer on top of your coding tools, not another project-management ceremony.

**Build.** Move from a request to real project changes with a focused engineering workflow.

**Debug.** Follow the evidence, fix the actual path that failed, and verify the result.

**Review.** Look for bugs, regressions, security problems, and the changes that genuinely matter.

**Test.** Run the checks that prove the work, then keep the process moving.

Skills are loaded when they matter, while project guidance and hooks keep the agent grounded in the repository instead of drifting into generic advice.

## Use the skills with other coding CLIs

LazyDev's own CLI is optional. The skills can travel to other compatible agents through the standard Skills CLI:

```bash
npx skills add BlizPS/lazy-developer-skill-cli --all
```

You can also target a supported agent directly:

```bash
npx skills add BlizPS/lazy-developer-skill-cli --agent claude-code
```

That universal route is separate from `lazydev chat`. LazyDev already ships its bundled skills, so you do not need the Skills CLI just to use LazyDev itself.

## Plugins and native integrations

Where an agent supports native plugins or extensions, LazyDev ships the corresponding integration metadata so you can follow that host's normal installation flow.

The repository includes integration surfaces for environments such as **Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Qoder, Devin, Grok, Kiro, and OpenClaw**.

In other words: keep the coding CLI you already like, and bring LazyDev's skills and integrations with it.

## Providers and models

LazyDev keeps the agent shell separate from the model provider. The built-in `lazydev chat` flow is powered by Kimi Code, while the model endpoint is selected during `lazydev setup`.

| Provider | Credential | Model selection |
| --- | --- | --- |
| **Gemini** | `GEMINI_API_KEY` | Live provider catalog |
| **OpenRouter** | `OPENROUTER_API_KEY` | Live provider catalog |
| **NVIDIA** | `NVIDIA_API_KEY` | Live provider catalog |
| **Anthropic** | `ANTHROPIC_API_KEY` | Live provider catalog |
| **OpenAI** | `OPENAI_API_KEY` | Live provider catalog |

For other coding CLIs, continue using that CLI's own authentication and model-selection flow. LazyDev's skills are independent of that choice.

## Updating

The same installer is both the installer and the updater. Run the command for your platform again:

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.ps1")))
```

It re-applies the pinned Kimi Code version **0.43.1** and refreshes LazyDev from the repository. Kimi Code 0.43.1 is a real upstream release dated September 15, 2026.

## Troubleshooting

If `lazydev chat` says no provider is configured, run `lazydev setup` and save a provider, API key, and model first.

If `lazydev chat` says Kimi Code is missing, rerun the platform installer. The installer checks the native `kimi` launcher instead of relying on npm.

If `lazydev` is installed but the shell cannot find it immediately, open a new terminal or reload your shell profile so the user-level bin directory is picked up.

## Project

Source: https://github.com/BlizPS/lazy-developer-skill-cli

Issues and feature requests: https://github.com/BlizPS/lazy-developer-skill-cli/issues

## Development

The packaged CLI is still a normal Node.js project for contributors, and the repository keeps its npm metadata for publishing/CI compatibility. The **end-user installers do not depend on npm**.

Run the test suite from the repository root:

```bash
npm test
```

The validation suite checks package structure, skills, integrations, runtime behavior, provider routing, platform behavior, and installer consistency.

## License

MIT
