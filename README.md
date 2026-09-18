<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/free-kimi-code-dark.svg">
    <img src="assets/free-kimi-code-light.svg" alt="Lazy Developer" width="720">
  </picture>

  <br>
  <br>

    [![Version](https://img.shields.io/badge/version-1.0.0-6f42c1)](https://github.com/BlizPS/lazy-developer-free-kimi-code)
  [![Kimi Code](https://img.shields.io/badge/Kimi%20Code-2.0.0-111111)](https://github.com/MoonshotAI/kimi-code)
  [![CI](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/ci.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/ci.yml)
  [![Validate](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/validate.yml/badge.svg)](https://github.com/BlizPS/lazy-developer-free-kimi-code/actions/workflows/validate.yml)
  [![Stars](https://img.shields.io/github/stars/BlizPS/lazy-developer-free-kimi-code?style=flat)](https://github.com/BlizPS/lazy-developer-free-kimi-code/stargazers)
  [![Forks](https://img.shields.io/github/forks/BlizPS/lazy-developer-free-kimi-code?style=flat)](https://github.com/BlizPS/lazy-developer-free-kimi-code/network/members)
  [![Issues](https://img.shields.io/github/issues/BlizPS/lazy-developer-free-kimi-code?style=flat)](https://github.com/BlizPS/lazy-developer-free-kimi-code/issues)
  [![License](https://img.shields.io/badge/license-MIT-111111)](LICENSE)

  <p>
    <a href="https://github.com/BlizPS/lazy-developer-free-kimi-code/issues">Issues</a> ·
    <a href="https://github.com/BlizPS/lazy-developer-free-kimi-code/discussions">Discussions</a>
  </p>

  <p>
    <em>A calm, capable developer layer for Kimi Code.</em><br>
    <em>Live models, portable skills, safe artifact handling, provider routing, and a cleaner terminal workflow — without replacing the Kimi Code experience.</em>
  </p>
</div>

## What is Lazy Developer?

Lazy Developer is a free, open-source developer layer for the Kimi Code CLI. It keeps Kimi Code's normal workflow while adding portable skills, model routing, safer artifacts, web-search fallback, and a quieter terminal.

```text
Lazy Developer
 ├── Kimi Code CLI
 ├── 4 portable skills
 ├── token-efficient responses
 ├── provider + model routing
 ├── safe artifact handling
 ├── web-search fallback
 └── RTK terminal cleanup
```

## ✨ Highlights

### 🧠 4 focused skills

- `lazy-developer` — implementation, architecture, UI/UX, and engineering workflow
- `lazy-debug` — cause → fix → proof
- `lazy-review` — actionable findings without the usual essay
- `lazy-test` — focused testing and verification

They work through the normal skills system, so they can travel with compatible agent CLIs instead of being glued to Lazy Developer itself.

### 🪶 Real response economy

Lazy Developer includes an active runtime response-economy layer targeting ~75% less avoidable prose. It is applied across the supported CLI/plugin paths, not just written as a suggestion inside a skill.

The goal is simple: keep the code, commands, decisions, and useful evidence while cutting filler.

### ⚡ RTK integration

Rust Token Killer (RTK) trims noisy terminal output before it reaches the model, reducing one of the more pointless ways an agent can burn context.

### 🔌 Live model routing

`lazydev setup` discovers available models and configures the selected route without replacing the native Kimi Code experience.

### 🔐 Native Kimi auth

`/login` and `/logout` stay native to Kimi Code. Lazy Developer keeps inference routing separate so authentication does not silently replace your selected model.

### 🧩 Session compatibility

Model changes can use compatibility aliases for older LazyDev model names without rewriting the saved conversation history.

### 📁 Safe artifacts

Standalone files use the canonical `lazydevfile` directory and never overwrite an existing artifact. When a filename already exists, Lazy Developer uses the lowest free numeric suffix instead.

```text
report.html
report1.html
report2.html
```

### 🌐 Search fallback

When the host search service is unavailable, the bundled `lazydev-search` MCP service can provide web search without forcing a provider switch.

## 📦 Installation

### Lazy Developer CLI

#### macOS / Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

#### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

After installation:

```sh
lazydev setup
lazydev chat
```

### Universal Skills CLI

The bundled skills can also be installed independently for compatible agent CLIs:

```sh
npx skills add BlizPS/lazy-developer-free-kimi-code --all
```

This installs the same bundled skills without requiring the `lazydev` CLI.

## 🔄 Updating

### macOS / Linux

Run the installer again to refresh the current installation:

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

Run the PowerShell installer again:

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

Then verify the installed version:

```sh
lazydev version
```

## 🗑️ Uninstalling

### macOS / Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.ps1")))
```

> Uninstalling the Lazy Developer CLI does not imply removing skills installed separately through a compatible skills manager.

## 🐢 Termux / Android

Kimi Code's Linux binary needs a glibc-based Linux userland. On Termux, use a Debian or Ubuntu guest:

```sh
pkg update
pkg install proot-distro
proot-distro install debian
proot-distro login debian
```

Run the normal Lazy Developer installer inside the guest:

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
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

## 🛡️ Safe by default

- Standalone artifacts never overwrite existing files.
- Saved sessions stay in place during normal model switching.
- Strict proxy routes can repair incomplete tool-call history.
- Never commit API keys, OAuth tokens, or provider credentials.

## 📄 License

MIT — see [LICENSE](LICENSE).

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Lazy Developer 1.0.0</sub>
</div>
