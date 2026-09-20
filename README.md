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
    <strong>Supercharge Kimi Code with portable AI skills, live model routing, plugins, and powerful developer tools.</strong><br>
    <em>Keep the familiar Kimi Code workflow while adding a stronger, cleaner developer experience.</em>
  </p>
</div>

## What is Lazy Developer?

Lazy Developer is a free, open-source toolkit built around Kimi Code. It adds reusable AI skills, live provider/model discovery, model-aware tool handling, context protection, safer artifacts, search/browser resilience, and a cleaner terminal workflow without replacing the core Kimi Code experience.

## Why Lazy Developer?

Kimi Code already provides the agent workflow. Lazy Developer focuses on the layer around it:

```text
Kimi Code
   │
   ├── Portable AI Skills
   ├── Live Provider / Model Discovery
   ├── Model-Aware Tools
   ├── Context Protection
   ├── Safer Artifacts
   ├── Search / Browser Resilience
   └── Cleaner Terminal Output
```

The goal is simple: keep the familiar agent experience while making longer, tool-heavy coding sessions easier to manage.

## Built on Kimi Code

Lazy Developer is designed around the Kimi Code workflow rather than replacing it.

<p align="center">
  <img src="https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/docs/media/intro.gif" alt="Kimi Code demo" width="860">
</p>

<p align="center">
  <sub>Example Kimi Code workflow from the official <a href="https://github.com/MoonshotAI/kimi-code">MoonshotAI/kimi-code</a> repository</sub>
</p>

Learn more about Kimi Code:  
https://github.com/MoonshotAI/kimi-code

## ✨ What You Get

### 🧠 Portable AI Skills

Focused skills ship with the project for implementation, debugging, review, testing, and reusable engineering workflows.

They are packaged so compatible agent/plugin environments can use the same skill collection independently.

### ⚡ Live Provider & Model Discovery

Run:

```sh
lazydev setup
```

Lazy Developer can discover provider and model information from live catalogs where supported instead of relying on one permanently hard-coded model roster.

Use `lazydev setup` to inspect the providers, models, credentials, and capabilities available on the current installation.

### 🔌 Model-Aware Tool Handling

When a selected model supports native tool calling, Lazy Developer can use it directly.

When native tool calling is unavailable on the selected route, the runtime can use a compatible synthetic tool protocol with the same model instead of silently switching to another model.

Tool behavior is therefore based on model capability rather than one fixed model ID.

### 🪶 Context Optimization

Long coding sessions can accumulate large amounts of tool output and archived history.

Lazy Developer helps keep the active context useful with:

- token budgeting
- rolling tool-output pruning
- relevance-aware archive/retrieval
- proactive context protection
- preservation of useful code, paths, commands, errors, URLs, decisions, and evidence

The runtime does not pretend that the model has a smaller fixed context window. It focuses on using the available context more efficiently.

### ⚡ RTK-Powered Terminal Output

Rust Token Killer (RTK) is integrated for supported shell commands so unnecessary terminal output can be reduced before it reaches the model.

This keeps terminal-heavy sessions lighter on tokens and context.

### 🧠 Thinking Compatibility

Provider and model metadata are respected for reasoning/thinking behavior where supported.

Model-specific capabilities can be preserved without forcing one generic runtime setting onto every route.

### 🛡️ Context & Session Safety

Lazy Developer separates active request context from archived history and tool output, keeps existing sessions usable across normal provider/model changes, and avoids blindly injecting unrelated archived content into every request.

### 📁 Safe Artifacts

Standalone artifacts use the canonical `lazydevfile` directory and do not overwrite existing files.

Collisions receive the lowest available numeric suffix:

```text
report.html
report1.html
report2.html
```

### 🌐 Search & Browser Resilience

Search, browser, and file operations include validation and recovery checks for common malformed tool arguments.

Large outputs can also be handled without blindly filling the active context.

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

### Universal Skills

The bundled skills can also be installed independently for compatible agent CLIs:

```sh
npx skills add BlizPS/lazy-developer-free-kimi-code --all
```

## 🚀 Quick Start

After installation:

```sh
lazydev setup
```

Inspect the available providers and models.

Start a coding session:

```sh
lazydev chat
```

Check the installation:

```sh
lazydev doctor
```

Show the installed version:

```sh
lazydev version
```

## 🧩 Skills & Plugin Support

Lazy Developer is designed so its skills can be used beyond the main CLI in compatible agent and plugin environments.

The repository includes reusable skill assets and compatibility-oriented project integrations for agent workflows such as:

- Kimi Code
- Codex-compatible environments
- Claude-compatible plugin environments
- OpenCode
- OpenClaw
- Cursor
- Other compatible skill/plugin runtimes

Compatibility can vary by environment and feature.

## 🧰 Useful Commands

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

## 🔄 Updating

Re-run the matching installer, then verify:

```sh
lazydev version
lazydev doctor
```

## 🐢 Termux / Android

Kimi Code's Linux binary requires a glibc-based Linux userland.

On Termux, use a Debian or Ubuntu guest:

```sh
pkg update
pkg install proot-distro

proot-distro install debian
proot-distro login debian
```

Then run the normal Lazy Developer installer inside the guest.

## 🛡️ Safe by Default

- Standalone artifacts never overwrite existing files.
- Saved sessions stay in place during normal model switching.
- Strict proxy routes can repair incomplete tool-call history.
- Never commit API keys, OAuth tokens, or provider credentials.

## 🤝 Contributing

Bug reports, feature requests, documentation improvements, and compatible skill contributions are welcome.

Use GitHub Issues and Discussions for project feedback, compatibility reports, ideas, and community support.

## 📄 License

MIT — see [LICENSE](LICENSE).

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Lazy Developer 1.0.1</sub>
</div>
