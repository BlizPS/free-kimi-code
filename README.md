<div align="center">
  <img src="./assets/free-kimi-code-logo.svg" alt="Free Kimi Code" width="720">

  <br>
  <br>

  [![Validated](https://img.shields.io/badge/validated-1.0.3-22C55E?style=for-the-badge)](https://github.com/BlizPS/free-kimi-code/actions)
  [![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)
  [![Platforms](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows%20%C2%B7%20Termux-0EA5E9?style=for-the-badge)](#-installation)
  [![Stars](https://img.shields.io/github/stars/BlizPS/free-kimi-code?style=for-the-badge&color=F59E0B)](https://github.com/BlizPS/free-kimi-code/stargazers)

  <p>
    <strong>One portable developer layer for Kimi Code, Codex, Antigravity, and Claude Code.</strong><br>
    <em>Keep the native CLI experience. Share skills, routing, context controls, MCP, artifacts, and developer tooling.</em>
  </p>
</div>

---

[Installation](#-installation) · [Features](#-features) · [Commands](#commands) · [Integrations](#-native-cli-integrations) · [Contributing](#-contributing)

# Free Kimi Code

**Free Kimi Code** is a free, open-source developer layer for **Kimi Code**, **Codex CLI**, **Antigravity CLI**, and **Claude Code**. It keeps their native interfaces while Lazy Developer provides the shared coding layer underneath.

```text
Kimi Code · Codex · Antigravity · Claude Code
        │
        ├── Portable AI skills
        ├── Live model routing
        ├── Context + token optimization
        ├── MCP search / browser tools
        ├── Safe artifact handling
        ├── Developer intelligence
        └── Native session compatibility
```

> Free Kimi Code is free software. Upstream model/provider availability, limits, authentication, and pricing are controlled by their respective services.

## ✨ Features

### 🧠 Portable AI Skills

Four focused skills are bundled: `lazy-developer`, `lazy-debug`, `lazy-review`, and `lazy-test`. The same skills can be used by compatible agent and plugin environments.

### ⚡ Live Provider & Model Routing

Run `lazydev setup` to see the providers and models currently available to your installation. The catalog stays dynamic instead of being hard-coded in the README.

### 🤖 Four Native CLI UIs

The installer can install **Kimi Code → Codex → Antigravity → Claude Code** in that order. Each component is optional through a `Y/n` prompt. When all four are installed, `lazydev chat` and `lazydev resume` offer all four native UIs.

Claude Code uses the same LazyDev provider/model route as the other native CLIs. No second provider setup is required.

### 🎯 Model-Aware Tools & Thinking

LazyDev checks route capabilities and preserves the selected model when possible. Models without native tool calling can use compatible local synthetic tool handling.

### 🪶 Context Efficiency

Token budgets, rolling output pruning, relevance-aware retrieval, virtual context, and session compaction keep long coding sessions focused.

### 🌐 Search, Browser & MCP

The bundled search/browser layer provides Unicode-safe output, focused reads, argument validation, and filesystem-safe boundaries.

### 📁 Safe Artifacts

Generated files use the canonical `lazydevfile` workspace and are create-only. Existing artifacts and native client data are preserved.

### 🎨 UI, 3D, SEO & Language Intelligence

`lazydev ui <brief>` can generate a searchable design system before implementation. Research gates and `lazydev lang` provide current design/SEO/3D research and language-aware coding contracts.

## 📦 Installation

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.ps1")))
```

The installer asks which native coding CLIs to install or update. The order is **Kimi Code → Codex → Antigravity → Claude Code**, with each choice using `Y/n`.

Then configure the current provider/model catalog and open the UI:

```sh
lazydev setup
lazydev chat
```

### Skills

`lazydev chat` syncs the bundled Lazy Developer skills into each supported native CLI, including Claude Code.

## Commands

```text
lazydev setup             Configure the available provider/model route
lazydev chat              Open a selected native coding UI
lazydev resume            Resume a saved native chat
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

**Kimi Code**, **Codex CLI**, **Antigravity CLI**, and **Claude Code** keep ownership of their native interfaces and session behavior. Lazy Developer provides the shared routing, context/token layer, skills, MCP, artifact policy, and installation discovery.

### Claude Code

When Claude Code is selected from `lazydev chat`, it uses the same configured LazyDev route while keeping the native Claude Code interface and session flow.

### Resume

```sh
lazydev resume
```

The chooser includes any installed native UI, including Claude Code. Claude Code uses its native `--continue` flow.

## 🔄 Updating

Re-run the installer, then verify:

```sh
lazydev version
lazydev doctor
```

## 🧪 Verification

The repository includes smoke tests covering skills, providers, MCP, artifacts, filesystem guards, context handling, sessions, proxies, authentication, installers, efficiency, language detection, and plugin manifests.


## 📚 Docs

[Getting Started](docs/getting-started.md) · [Claude Code Integration](docs/claude-code.md) · [Skills](docs/skills.md) · [Provider & Model Routing](docs/provider-routing.md) · [Troubleshooting](docs/troubleshooting.md)

[Architecture](ARCHITECTURE.md) · [Compatibility](COMPATIBILITY.md) · [Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md)

## ❓ FAQ

**What is Free Kimi Code?**  
A free, open-source Lazy Developer layer for Kimi Code, Codex CLI, Antigravity CLI, and Claude Code.

**How do I see available providers and models?**  
Run `lazydev setup`. The catalog is intentionally dynamic.

**Does it replace the native CLIs?**  
No. The native interfaces and session systems remain in charge.

**Does Free Kimi Code make every upstream model free?**  
No. Upstream access and limits depend on the configured service.

## 🗑️ Uninstall

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.ps1")))
```

The uninstallers remove LazyDev-managed files while preserving supported native client data and RTK user data.

## 🤝 Contributing

Bug reports, compatibility reports, documentation fixes, skills, and integration improvements are welcome. Use [Issues](https://github.com/BlizPS/free-kimi-code/issues) for concrete bugs and feature requests, [Discussions](https://github.com/BlizPS/free-kimi-code/discussions) for ideas, and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

If Free Kimi Code is useful to you, a star helps other developers discover the project.

## License

MIT. See [LICENSE](LICENSE).

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Free Kimi Code 1.0.3 · Lazy Developer · Kimi Code + Codex + Antigravity + Claude Code</sub>
</div>
