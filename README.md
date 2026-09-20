<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/free-kimi-code-dark.svg">
    <img src="assets/free-kimi-code-light.svg" alt="Lazy Developer" width="720">
  </picture>

  <br>
  <br>

[![Version](https://img.shields.io/badge/version-1.0.1-7C3AED?style=for-the-badge)](https://github.com/BlizPS/lazy-developer-free-kimi-code)
[![License: MIT](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20·%20Linux%20·%20Windows%20·%20Termux-0EA5E9?style=for-the-badge)](#-installation)
[![Stars](https://img.shields.io/github/stars/BlizPS/lazy-developer-free-kimi-code?style=for-the-badge&color=F59E0B)](https://github.com/BlizPS/lazy-developer-free-kimi-code/stargazers)

  <p>
    <a href="https://github.com/BlizPS/lazy-developer-free-kimi-code/issues">Issues</a> ·
    <a href="https://github.com/BlizPS/lazy-developer-free-kimi-code/discussions">Discussions</a>
  </p>

  <p>
    <em>A calm, capable developer layer for Kimi Code.</em><br>
    <em>Live models, portable skills, safe artifact handling, provider routing, and a quieter terminal.</em>
  </p>
</div>

## What is Lazy Developer?

Lazy Developer is a free, open-source developer layer for Kimi Code. It stays close to the familiar Kimi Code agent workflow while adding portable skills, live model/provider discovery, capability-aware tools, context protection, and a quieter terminal.

## Built on Kimi Code

Lazy Developer is designed around the Kimi Code workflow rather than replacing it. The goal is simple: keep the agent experience familiar, then make long coding sessions more efficient with better routing, smarter tool handling, and tighter token/context usage.

<p align="center">
  <img src="https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/docs/media/intro.gif" alt="Kimi Code demo" width="860">
</p>

<p align="center">
  <sub>Example Kimi Code workflow from the official <a href="https://github.com/MoonshotAI/kimi-code">MoonshotAI/kimi-code</a> repository</sub>
</p>

## ✨ Highlights

### 🧠 Portable agent skills

Focused skills ship with the project for implementation, debugging, review, testing, and reusable engineering workflows. They are packaged so the same skill set can travel across compatible agent/plugin environments.

### 🪶 Token-efficient by design

Lazy Developer reduces avoidable response overhead while preserving code, paths, commands, errors, URLs, decisions, and useful evidence.

The runtime also protects the active context with token budgeting, rolling tool-output pruning, relevance-aware archive/retrieval, and a proactive context guard. The model's real context window is preserved; the runtime focuses on using it efficiently instead of pretending a smaller fixed limit exists.

### ⚡ RTK-powered terminal output

Rust Token Killer (RTK) is integrated into the workflow for supported shell commands so noisy terminal output can be reduced before it reaches the model. This keeps terminal-heavy tasks lighter on tokens and context.

### 🔌 Live providers & model catalogs

Provider and model setup is discovered from live catalogs where supported instead of relying on a fixed model roster. Run `lazydev setup` to inspect the providers, models, credentials, and capabilities available on the current installation.

### 🧩 Native tools + synthetic tool bridge

When a model supports native tool calling, Lazy Developer can use it directly. When the selected route does not, the runtime can detect that capability and use a synthetic tool protocol with the same model instead of silently switching models.

Tool support is therefore capability-aware rather than tied to one model ID.

### 🧠 Thinking compatibility

Provider metadata is respected for reasoning/thinking behavior. Model-specific capabilities can be preserved without overwriting them with a generic runtime setting.

### 🛡️ Context & session safety

Lazy Developer separates active model context from archived history/tool output, keeps old sessions compatible across provider/model changes, and avoids dumping unrelated archived content back into every request.

### 📁 Safe artifacts

Standalone artifacts use the canonical `lazydevfile` directory and do not overwrite existing files. Collisions receive the lowest available numeric suffix:

```text
report.html
report1.html
report2.html
```

### 🌐 Search & browser resilience

Search, browser, and file paths include validation and recovery checks for common malformed tool arguments, while large outputs can be handled without blindly filling the active context.

## 📦 Installation

### macOS / Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

Then:

```sh
lazydev setup
lazydev chat
```

### Universal skills

The bundled skills can also be installed independently for compatible agent CLIs:

```sh
npx skills add BlizPS/lazy-developer-free-kimi-code --all
```

## 🔄 Updating

Rerun the matching installer, then verify:

```sh
lazydev version
```

## 🧰 Useful commands

```text
lazydev help
lazydev setup
lazydev chat
lazydev sessions
lazydev skills
lazydev artifact <filename>
lazydev env
lazydev doctor
lazydev version
```

## 🐢 Termux / Android

Kimi Code's Linux binary needs a glibc-based Linux userland. On Termux, use a Debian or Ubuntu guest:

```sh
pkg update
pkg install proot-distro
proot-distro install debian
proot-distro login debian
```

Then run the normal Lazy Developer installer inside the guest.

## 🛡️ Safe by default

- Standalone artifacts never overwrite existing files.
- Saved sessions stay in place during normal model switching.
- Strict proxy routes can repair incomplete tool-call history.
- Never commit API keys, OAuth tokens, or provider credentials.

## 📄 License

MIT — see [LICENSE](LICENSE)

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Lazy Developer 1.0.1</sub>
</div>
