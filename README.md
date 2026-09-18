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

Lazy Developer is built around one simple idea: your coding agent should spend its context on the work, not on repeating setup, dumping unnecessary command output, or dragging a giant pile of instructions through every turn.

The built-in CLI uses **Kimi Code**. The same skills and integration files can also be used from other agent ecosystems that support skills or plugins.

## Get started

### 1. Install or update

The desktop installer does the heavy lifting for you. It installs or checks **Kimi Code 0.43.1**, **RTK**, and **Lazy Developer 1.0.0** in one go — no npm required.

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

Run the same installer again whenever you want to update.

It checks each component separately. If Kimi Code is already at the managed version, it is skipped. If the Lazy Developer GitHub revision has not changed, Lazy Developer is skipped. RTK is checked against its current stable release. So you do not get a full reinstall just because one part changed.

Updates replace the Lazy Developer installation directory, not the Kimi data directory. Existing Kimi sessions and saved configuration are kept.

> **Termux / Android:** the native desktop Kimi installer is not the Termux installation path. Use the Kimi method supported by your Termux environment.

### 2. Set up your provider

Before the first session, run:

```bash
lazydev setup
```

Pick a provider, add its API key, and choose a live model. The setup currently supports **Gemini, OpenRouter, NVIDIA, Anthropic, and OpenAI**.

Lazy Developer saves that choice, so you do not have to configure the same provider every time.

### 3. Start coding

When setup is saved, start the actual Kimi session with:

```bash
lazydev chat
```

`lazydev` by itself opens the Lazy Developer command center. `lazydev chat` is the command that starts the coding session.

## RTK, already wired in

RTK is installed automatically by the desktop installer and connected to Kimi Code.

RTK focuses on the thing agents see a lot of: shell output. Its project describes **up to 90% fewer terminal-output tokens** on supported commands. That is output reduction, not a guarantee that every conversation or provider bill will be 90% cheaper.

Lazy Developer initializes the Kimi integration in the Kimi data directory rather than modifying each project you work on.

For a deeper look at RTK itself, see [rtk-ai/rtk](https://github.com/rtk-ai/rtk).

## Skills without the bloat

The bundled Lazy Developer skills are kept compact and loaded through Kimi's skill discovery instead of being copied into one giant permanent prompt.

The package ships focused skills for implementation, debugging, review, and testing. The runtime also adds guardrails for artifacts, shell operations, workspace context, and unnecessary rewrites.

The goal is simple: give the agent the right instructions when they matter, while keeping the default context small.

## Use the same skills with other CLIs

Lazy Developer is not locked to its own CLI.

For another agent that supports the standard Skills CLI, install the skills directly into that agent/project:

```bash
npx skills add BlizPS/lazy-developer-free-kimi-code --all
```

That is the **universal path**. You do not need it for Lazy Developer itself; the LazyDev CLI already includes and wires its bundled skills.

The repository also contains plugin/integration metadata for several agent ecosystems, so the skills can follow you when you switch tools.

## Providers

Lazy Developer keeps provider setup separate from the Kimi Code shell.

| Provider | API key | Model selection |
| --- | --- | --- |
| **Gemini** | `GEMINI_API_KEY` | Live provider catalog |
| **OpenRouter** | `OPENROUTER_API_KEY` | Live provider catalog |
| **NVIDIA** | `NVIDIA_API_KEY` | Live provider catalog |
| **Anthropic** | `ANTHROPIC_API_KEY` | Live provider catalog |
| **OpenAI** | `OPENAI_API_KEY` | Live provider catalog |

The OpenAI entry is intentionally shown as **OpenAI** in the UI.

## Token efficiency

Lazy Developer keeps a local token-budget gate around the bundled skill/runtime layer.

The current baseline measures roughly **690 estimated skill tokens versus 4,042 baseline tokens**, which is an **82.9% reduction in skill payload size**. The static CLI hot path is roughly **942 tokens**, about **76.7% below** that stored baseline.

Those are project-level measurements. They are not a promise that every prompt, task, or provider bill will use the same percentage because actual usage depends on your task, model, context, tools, and conversation history.

## Updating

There is no separate updater command. Just run the same installer again:

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

Only changed components are refreshed. When everything is already current, the installer skips everything.

## Uninstall everything

The matching uninstallers remove the installation rather than leaving a half-installed setup behind.

This project removes:
- Lazy Developer
- Kimi Code installed/managed by Lazy Developer
- RTK installed/managed by Lazy Developer
- LazyDev configuration and Kimi session data
- RTK configuration
- LazyDev launcher files
- the default `lazydevfile` artifact directory
- legacy npm installs of the LazyDev/Kimi packages when npm is already available

Project folders outside those managed locations are left untouched.

### macOS / Linux

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.ps1")))
```

After uninstalling, the normal way back is simply to run the installer again.

## Troubleshooting

If `lazydev chat` says the provider is not configured, run `lazydev setup` and save a provider, API key, and model.

If `lazydev` is not found just after installation, open a new terminal so the updated user `PATH` is loaded.

On Windows, Kimi Code requires Git for Windows because it uses Git Bash as its shell environment. If Git Bash is installed somewhere unusual, configure Kimi's shell path before starting a session.

## Project

Source: https://github.com/BlizPS/lazy-developer-free-kimi-code

Issues: https://github.com/BlizPS/lazy-developer-free-kimi-code/issues

## Development

The repository keeps npm metadata for package tooling and CI, but the normal desktop install path does not require npm.

From the repository root:

```bash
npm test
```

## License

MIT
