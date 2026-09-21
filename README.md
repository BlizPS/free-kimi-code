<div align="center">
  <img src="./assets/free-kimi-code-logo.svg" alt="Free Kimi Code" width="720">

  <br>
  <br>

  [![Version](https://img.shields.io/badge/version-1.0.2-7C3AED?style=for-the-badge)](https://github.com/BlizPS/free-kimi-code)
  [![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)
  [![Platforms](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows%20%C2%B7%20Termux-0EA5E9?style=for-the-badge)](#-installation)
  [![Stars](https://img.shields.io/github/stars/BlizPS/free-kimi-code?style=for-the-badge&color=F59E0B)](https://github.com/BlizPS/free-kimi-code/stargazers)

  <p>
    <a href="https://github.com/BlizPS/free-kimi-code/issues">Issues</a> ·
    <a href="https://github.com/BlizPS/free-kimi-code/discussions">Discussions</a>
  </p>

  <p>
    <strong>One portable LazyDev layer for Kimi Code, Codex, and Antigravity.</strong><br>
    <em>Keep the native CLI experience. Share the routing, skills, context controls, MCP, and developer workflow.</em>
  </p>
</div>

---

## What is Free Kimi Code?

**Free Kimi Code** is a portable, open-source developer layer built around **Kimi Code**, **Codex**, and **Antigravity**.

It does not replace their terminal UIs. Instead, Lazy Developer sits underneath them and keeps the parts that should be shared in one place:

```text
Kimi Code · Codex · Antigravity
        │
        ├── Provider / model routing
        ├── Portable LazyDev Skills
        ├── Context + token optimization
        ├── Search / browser resilience
        ├── MCP integration
        ├── Safe artifact handling
        └── Persistent CLI discovery
```

The result is a familiar native CLI on top, with one consistent runtime underneath.

---

## ✨ What You Get

### 🧠 Native AI CLI UIs

Choose the terminal surface you already like:

- **Kimi Code** — native Kimi Code workflow and session handling.
- **Codex** — official Codex CLI launched directly, without a LazyDev tmux wrapper.
- **Antigravity** — native `agy` terminal workflow with the shared LazyDev layer.

`lazydev chat` detects installed UIs from persisted executable paths, known native install locations, package-manager bins, and PATH fallback.

### ⚡ Live Provider & Model Routing

```sh
lazydev setup
```

Choose a provider, discover its available models, and keep the selected route consistent across the supported UIs.

When the selected model does not expose native tool calling, LazyDev can keep the same model and bridge the tool protocol locally instead of silently replacing the model.

### 🪶 Context Efficiency

Long coding sessions can collect huge tool outputs and historical context. LazyDev keeps the active window focused with rolling output trimming, retained session history, and relevance-aware retrieval.

The goal is **better use of the model's actual context**, not pretending a model has a smaller hard limit.

### ⚡ RTK Integration

The installer integrates **Rust Token Killer (RTK)** for supported terminal output, reducing repetitive shell output before it reaches the model.

RTK is stored separately from the LazyDev runtime so refreshing LazyDev does not remove the RTK executable.

### 📁 Safe Artifacts

Standalone generated files use the canonical `lazydevfile` workspace and are create-only:

```text
landing-page.html
landing-page1.html
landing-page2.html
```

Existing standalone artifacts are not overwritten, and generic placeholder names such as `index.html`, `output.*`, or `result.*` are avoided.

### 🧩 Portable Skills

The repository ships reusable skills for implementation, debugging, review, and testing. The same skill set can be shared across compatible agent environments.

---

## 🔌 MCP Layer

LazyDev keeps MCP intentionally small instead of dumping a huge server catalog into every session.

### Included

**`lazydev-search`** is the bundled local search/browser MCP. It runs from the LazyDev runtime and is configured for Kimi Code, Codex, and Antigravity without replacing the UI's native tools.

**Context7** is also added automatically when `npx` is available. The current pinned package is `@upstash/context7-mcp@4.1.1`, which provides documentation-oriented context without requiring a token for the basic local setup.

The Context7 server is configured through local stdio, not a remote HTTP endpoint. This keeps the default configuration simpler and avoids the remote-MCP edge cases reported by some CLI clients.

### Optional: GitHub MCP

For repository, issue, pull request, Actions, and code context, the official **GitHub MCP Server** is the stronger optional addition. It requires its own GitHub authentication and can expose write-capable tools, so Free Kimi Code does **not** enable it automatically.

Official project:

`https://github.com/github/github-mcp-server`

The current GitHub MCP Server release is **1.12.2**. Configure only the toolsets you actually need, and prefer read-only mode when write operations are unnecessary.

---

## 📦 Installation

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/install.ps1")))
```

The installer collects the requested native AI UIs first, then keeps the runtime layers consistent:

```text
RTK
 ↓
Lazy Developer
 ↓
selected native AI CLI(s)
```

Provider/model setup is separate:

```sh
lazydev setup
```

Then launch:

```sh
lazydev chat
```

---

## 🗑️ Uninstall

### macOS / Linux / Termux Linux

```sh
curl -fsSL "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/free-kimi-code/main/uninstall.ps1")))
```

The uninstaller removes Free Kimi Code / LazyDev-managed launchers, state, integrations, caches, and `lazydevfile` artifacts. Native Kimi Code, Codex, Antigravity, and RTK user data are preserved.

---

## 🔄 Reinstalling is safe

The installer keeps persistent executable paths outside the replaceable LazyDev runtime.

A normal reinstall or a new terminal does not make an existing CLI look missing just because `PATH` changed. The installer only downloads a CLI again when its actual executable is absent or a newer release needs to be installed.

Legacy installations that stored Codex or RTK inside the old LazyDev runtime are migrated back to durable external locations before that runtime is refreshed.

---

## 💬 Commands

```text
lazydev setup
lazydev chat
lazydev resume
lazydev doctor
lazydev skills
lazydev path
lazydev version
lazydev ui-demo
```

### Resume

```sh
lazydev resume
```

LazyDev keeps the native resume flow for each UI instead of inventing a parallel session format:

- Kimi Code uses its native session picker.
- Codex uses `codex resume`.
- Antigravity uses its native `/resume` flow.

---

## 🛠️ Codex Integration

Codex is launched through its resolved **official executable path**. LazyDev does not replace `codex` with a tmux compatibility command.

LazyDev provides Codex with a private routing endpoint through `CODEX_HOME/config.toml`, then translates the provider response into the Responses API event format expected by Codex.

The bridge emits the completed assistant `response.output_item.done` event as part of every streamed response, so native Codex transcript features such as `/copy` can see the last assistant response correctly.

---

## 🛰️ Antigravity Integration

Antigravity keeps its native `agy` executable and native home-level configuration. LazyDev adds only its managed MCP entry and preserves unrelated MCP servers.

The current Antigravity configuration path is:

```text
~/.gemini/config/mcp_config.json
```

Skills continue to use the native Antigravity user skill location rather than being hidden inside the LazyDev workspace.

---

## 🐢 Termux / Android

Kimi Code, Codex, and Antigravity have platform-specific terminal/runtime requirements. For Termux, a glibc Linux guest such as Debian or Ubuntu is recommended for the native Linux CLI binaries.

```sh
pkg update
pkg install proot-distro
proot-distro install debian
proot-distro login debian
```

Then use the normal installer inside the guest.

Codex is still launched directly. LazyDev does not install a tmux wrapper around the public `codex` command.

---

## 🔧 Developer Notes

Free Kimi Code is intentionally built around the native CLIs rather than cloning their UIs.

The shared layer owns routing, context management, skills, MCP registration, artifact policy, and installation state. Each external CLI remains responsible for its own TUI, authentication, sessions, and native configuration.

That separation makes upgrades safer and avoids hiding external CLI state inside a replaceable LazyDev runtime directory.

---

## 🤝 Contributing

Bug reports, compatibility reports, documentation improvements, and skill contributions are welcome.

Use [Issues](https://github.com/BlizPS/free-kimi-code/issues) for bugs and feature requests, and [Discussions](https://github.com/BlizPS/free-kimi-code/discussions) for ideas and community support.

---

## 📄 License

MIT. See [LICENSE](LICENSE).

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Free Kimi Code 1.0.2 · Lazy Developer · Kimi Code + Codex + Antigravity</sub>
</div>
