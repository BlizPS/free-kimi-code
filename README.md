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

Lazy Developer is a small layer that makes coding agents feel more intentional: focused skills, sensible guardrails, provider setup, and a CLI that gets out of the way when you just want to build.

The built-in workflow runs through **Kimi Code**, while the same skills can also be used with other compatible coding agents and plugin systems.

## Get started

### 1. Install or update

Use the installer for your platform. You can run the same command again later; it checks what is already installed and only updates what actually changed.

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.ps1")))
```

The installer uses Kimi Code's native installer, so the desktop setup does not require npm. The managed Kimi Code floor is **0.43.1**, and Lazy Developer is **1.0.0**.

On a repeat run, an unchanged Kimi Code installation is skipped. Lazy Developer is checked against the current GitHub revision; when the revision is unchanged, Lazy Developer is skipped too. When only Lazy Developer changed, only Lazy Developer is refreshed. When only Kimi Code changed, only Kimi Code is refreshed. When both changed, both are updated.

Your Kimi configuration and sessions live outside the Lazy Developer installation directory, so updating Lazy Developer does not wipe your existing session history.

> **Termux / Android:** the desktop native Kimi Code installer is not currently an Android/Termux install path. Use the Kimi Code method that is supported by your Termux environment rather than expecting the desktop installer to work there.

### 2. Set up your provider, API key, and model

Before the first coding session, run:

```bash
lazydev setup
```

Choose a provider, enter its API key, and select a live model. The built-in provider list includes **Gemini, OpenRouter, NVIDIA, Anthropic, and OpenAI**. Your chosen model is saved so the next session starts from the same setup.

### 3. Start coding

Then start the actual coding session with:

```bash
lazydev chat
```

That is the main flow. Running `lazydev` by itself opens the Lazy Developer command center; it does not jump straight into Kimi Code.

## What Lazy Developer brings

LazyDev keeps the useful parts close to the work. The bundled skills cover implementation, debugging, review, and verification, with extra attention to repository context, evidence, UI/UX consistency, and avoiding unnecessary rewrites.

Skills are deliberately compact. The runtime points Kimi Code at the bundled `skills/` directory and enables merged skill discovery, so the relevant `SKILL.md` files are available to the agent instead of being copied into a huge permanent prompt.

## Skills beyond LazyDev

Lazy Developer can also travel with the coding agent you already use. For a compatible agent, use the standard Skills CLI from your project or agent environment:

```bash
npx skills add BlizPS/lazy-developer-skill-cli --all
```

That universal path is **not required for LazyDev itself**. LazyDev already ships its bundled skills. It is there for other agents that support the Skills CLI.

## Plugins and agent integrations

The repository includes native integration metadata for several agent ecosystems, including Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Qoder, Devin, Grok, Kiro, and OpenClaw.

So the idea is simple: use `lazydev chat` for the built-in Lazy Developer flow, or bring the skills into another compatible agent through that agent's normal plugin/skills mechanism.

## Providers

Lazy Developer keeps the model provider separate from the coding-agent shell. The `lazydev setup` flow currently exposes:

| Provider | API key | Model selection |
| --- | --- | --- |
| **Gemini** | `GEMINI_API_KEY` | Live provider catalog |
| **OpenRouter** | `OPENROUTER_API_KEY` | Live provider catalog |
| **NVIDIA** | `NVIDIA_API_KEY` | Live provider catalog |
| **Anthropic** | `ANTHROPIC_API_KEY` | Live provider catalog |
| **OpenAI** | `OPENAI_API_KEY` | Live provider catalog |

The OpenAI integration uses the standard OpenAI provider configuration exposed by Kimi Code; the UI simply calls it **OpenAI**.

## Token efficiency

LazyDev includes a static token-budget gate so the skill layer stays small. In the current bundled baseline, the four skills use about **690 estimated tokens** versus a **4,042-token** baseline, which is an **82.9% reduction in skill payload size**. The combined static CLI hot path is about **942 tokens**, or **76.7% below** the stored baseline.

Those numbers measure the project's stored skill/runtime hot path. They are **not a promise that every conversation or provider bill will use 75% fewer tokens**; actual usage depends on the task, model, context, tool calls, and conversation history.

## Updating

There is no separate updater command. Run the installer for your platform again:

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-skill-cli/main/install.ps1")))
```

The updater compares the installed Kimi Code version and the current GitHub revision of Lazy Developer before replacing anything. If nothing changed, both components are skipped.

Updates do not delete the Kimi data directory used by LazyDev, so existing sessions remain available.

## Troubleshooting

If `lazydev chat` says a provider is not configured, run `lazydev setup` and save a provider, API key, and model.

If Kimi Code is missing, rerun the platform installer. The installer checks for the native `kimi` launcher before deciding whether Kimi needs an update.

If `lazydev` is not found immediately after installation, start a new terminal so your user-level `PATH` changes are loaded.

## Project

Source: https://github.com/BlizPS/lazy-developer-skill-cli

Issues: https://github.com/BlizPS/lazy-developer-skill-cli/issues

## Development

The repository keeps npm metadata for contributors, package tooling, and CI, but the end-user desktop installers do not require npm.

Run the test suite from the repository root:

```bash
npm test
```

## License

MIT
