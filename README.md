<div align="center">
  <img src="./assets/free-kimi-code-logo.svg" alt="Free Kimi Code" width="720">

  <br>
  <br>

  [![Validated](https://img.shields.io/badge/validated-1.0.0-22C55E?style=for-the-badge)](https://github.com/BlizPS/free-kimi-code/actions)
  [![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)
  [![Platforms](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows%20%C2%B7%20Termux-0EA5E9?style=for-the-badge)](#-installation)
  [![Stars](https://img.shields.io/github/stars/BlizPS/free-kimi-code?style=for-the-badge&color=F59E0B)](https://github.com/BlizPS/free-kimi-code/stargazers)

  <p>
    <strong>One portable developer layer for Kimi Code, Codex, Antigravity, Claude Code, and DeepSeek Harness.</strong><br>
    <em>Keep the native interfaces. Share skills, routing, context controls, MCP, artifacts, and developer tooling.</em>
  </p>
</div>

---

[Installation](#-installation) · [Features](#-features) · [Commands](#commands) · [Integrations](#-native-cli-integrations) · [Docs](docs/README.md)

# Free Kimi Code

**Free Kimi Code** is a free, open-source developer layer for **Kimi Code**, **Codex CLI**, **Antigravity CLI**, **Claude Code**, and **DeepSeek Harness**. Native interfaces stay in charge while Lazy Developer provides the shared layer underneath.

```text
Kimi Code · Codex · Antigravity · Claude Code · DeepSeek Harness
        │
        ├── Portable AI skills
        ├── Live model routing
        ├── Context + token optimization
        ├── MCP search / browser tools
        ├── Safe artifact handling
        ├── Developer intelligence
        └── Native session / Web UI compatibility
```

> Free Kimi Code is free software. Upstream availability, limits, authentication, and pricing stay with the configured services.

## ✨ Features

### 🧠 Portable AI Skills

Four focused skills are bundled: `lazy-developer`, `lazy-debug`, `lazy-review`, and `lazy-test`. They are shared across supported agent environments, including Claude Code and DeepSeek Harness.

### ⚡ Live Provider & Model Routing

Run `lazydev setup` to see the providers and models currently available to your installation. The catalog stays dynamic instead of being frozen in the README.

### 🤖 Five Coding Surfaces

The installer can install **Kimi Code → Codex → Antigravity → Claude Code → DeepSeek Harness** in that order. Each choice is optional with a `Y/n` prompt.

`lazydev chat` can open all five when installed. `lazydev resume` stays limited to the native session-based CLIs; DeepSeek Harness is a local Web UI and is intentionally not part of the resume picker.

### 🎯 Model-Aware Tools & Thinking

LazyDev checks route capabilities and preserves the selected model when possible. Models without native tool calling can use compatible local synthetic tool handling.

### 🪶 Context Efficiency

Token budgets, rolling output pruning, relevance-aware retrieval, virtual context, and session compaction keep long coding sessions focused.

### 🌐 Search, Browser & MCP

The bundled search/browser layer provides Unicode-safe output, focused reads, argument validation, and filesystem-safe boundaries.

### 📁 Safe Artifacts

Generated files use the canonical `lazydevfile` workspace. Existing artifacts and native client data are preserved.

### 🎨 UI, 3D, SEO & Language Intelligence

`lazydev ui <brief>` can generate a searchable design system before implementation. Research gates and `lazydev lang` provide research-aware and language-aware coding contracts.

## 📦 Installation

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.ps1" | iex
```

The installer asks which native coding CLIs to install or update in this order:

```text
Kimi Code → Codex → Antigravity → Claude Code → DeepSeek Harness
```

Each component uses its own `Y/n` prompt. DeepSeek Harness is the last choice because it runs as a local Web UI.

## 🐢 Termux / Android

Kimi Code's Linux binary requires a glibc-based Linux userland.

On Termux, use a Debian or Ubuntu guest:

```sh
pkg update
pkg install proot-distro

proot-distro install debian
proot-distro login debian
```

For Android/Termux, LazyDev pins the DeepSeek Harness runtime to the known Android-compatible release path instead of the newer builds that use unsupported native file locking. See [Troubleshooting](docs/troubleshooting.md).

Then configure the current provider/model catalog and open the UI:

```sh
lazydev setup
lazydev chat
```

## Commands

```text
lazydev setup             Configure the available provider/model route
lazydev chat              Open a selected coding UI
lazydev resume            Resume a saved native CLI chat
lazydev skills            Browse bundled LazyDev skills
lazydev artifact <name>   Work with a standalone artifact path
lazydev env               Inspect the runtime environment
lazydev universal         Show universal integration details
lazydev ui <brief>        Generate a searchable design system
lazydev lang              Detect the active language contract
lazydev doctor            Check installation and configuration
lazydev version           Show the installed version
```

## 🖥️ Native CLI Integrations

**Kimi Code**, **Codex CLI**, **Antigravity CLI**, and **Claude Code** keep their native terminal interfaces and session behavior. **DeepSeek Harness** keeps its native local Web UI and session workspace. Lazy Developer provides the shared routing, context/token layer, skills, MCP, artifact policy, and installation discovery.

### DeepSeek Harness

Select **DeepSeek Harness** from `lazydev chat`. LazyDev starts its local Web UI on loopback, connects its model layer to the active LazyDev route, installs the bundled skills into the isolated Harness home, and opens the local page when a supported browser launcher is available.

```text
✓ DeepSeek Harness selected

Starting DeepSeek Harness Web UI...
Connecting LazyDev proxy...
Loading active model...
Opening local browser...

DeepSeek Harness is ready
Web UI → http://127.0.0.1:<port>
Proxy   → Connected
Model   → Sonnet
```

### Resume

```sh
lazydev resume
```

The resume chooser includes installed native session CLIs. DeepSeek Harness is intentionally excluded because its workflow is Web UI based rather than a native terminal resume command.

## 🔄 Updating

Re-run the installer, then verify:

```sh
lazydev version
lazydev doctor
```

## 📚 Docs

[Getting Started](docs/getting-started.md) · [DeepSeek Harness](docs/deepseek-harness.md) · [Claude Code](docs/claude-code.md) · [Skills](docs/skills.md) · [Provider & Model Routing](docs/provider-routing.md) · [Troubleshooting](docs/troubleshooting.md)

[Architecture](ARCHITECTURE.md) · [Compatibility](COMPATIBILITY.md) · [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md)

## ❓ FAQ

**What is Free Kimi Code?**  
A free, open-source Lazy Developer layer for five native coding surfaces: Kimi Code, Codex CLI, Antigravity CLI, Claude Code, and DeepSeek Harness.

**How do I see available providers and models?**  
Run `lazydev setup`. The catalog is intentionally dynamic.

**Does it replace the native CLIs?**  
No. Native interfaces and session systems remain in charge.

## 🗑️ Uninstall

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.ps1")))
```

The uninstallers remove LazyDev-managed files while preserving native client data and user session data.

## 🤝 Contributing

Bug reports, compatibility reports, documentation fixes, skills, and integration improvements are welcome. Use [Issues](https://github.com/BlizPS/free-kimi-code/issues) for concrete bugs and feature requests, [Discussions](https://github.com/BlizPS/free-kimi-code/discussions) for ideas, and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

If Free Kimi Code is useful to you, a star helps other developers discover the project.

## License

MIT. See [LICENSE](LICENSE).

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Free Kimi Code 1.0.0 · Lazy Developer · Kimi Code + Codex + Antigravity + Claude Code + DeepSeek Harness</sub>
</div>
