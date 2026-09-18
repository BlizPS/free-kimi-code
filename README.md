<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/free-kimi-code-dark.svg">
    <img src="assets/free-kimi-code-light.svg" alt="Lazy Developer" width="720" />
  </picture>
  <h3>🦥 Lazy Developer</h3>
  <p><strong>A calm, capable developer layer for Kimi Code.</strong><br/>Live models, portable skills, safe artifact handling, provider routing, and a cleaner terminal workflow — without replacing the Kimi Code experience.</p>

  <br/>
  <br/>

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
</div>

> ⭐ **Like the project?** A GitHub star helps other developers discover it. If Lazy Developer saves you time, consider starring or sharing it.

## What is Lazy Developer?

Lazy Developer is a free, open-source developer layer built around **Kimi Code CLI**. It keeps the part developers actually care about — the coding agent — while adding a practical workflow around it.

Think of it as:

```text
Lazy Developer
     │
     ├── Kimi Code CLI
     ├── provider + model routing
     ├── portable skills
     ├── safe artifact handling
     ├── web-search fallback
     ├── session compatibility
     └── terminal cleanup via RTK
```

The project does **not** provide free API credits, bypass provider billing, or grant access to models you are not entitled to use. You bring the provider credentials you already have, and Lazy Developer routes Kimi Code through the model you select.

## Why people use it

### ⚡ One setup, live models

Run `lazydev setup`, choose a provider, and pick from the provider's live model catalog instead of relying on a frozen list.

### 🧠 Skills that stay useful

Bundled skills cover implementation, debugging, review, and testing. They are loaded through Kimi Code's normal skill system rather than pasted as a giant prompt on every turn.

### 🔌 Provider routing without rebuilding your workflow

Lazy Developer can route Kimi Code through several providers while keeping the same terminal experience. Compatibility providers can run through a local loopback proxy; direct providers use their native Kimi Code protocol.

### 🔐 Native Kimi login and logout stay native

`/login` and `/logout` remain Kimi Code commands with their normal interactive selectors. Lazy Developer keeps its own provider/model route separate, so authenticating a Kimi account does not silently replace your selected LazyDev model.

### 🧩 Old sessions are treated as history, not disposable config

When you change the active model, Lazy Developer can add compatibility aliases for older LazyDev model names. The saved conversation is left in place while the launch-time mapping points it at the current model.

### 📁 Safer standalone artifacts

Standalone files are written to the canonical `lazydevfile` directory. Existing files are never overwritten by the artifact router:

```text
report.html
report1.html
report2.html
...
```

### 🌐 Web search when the host search service is unavailable

Kimi Code's managed search is preferred when available. Lazy Developer also ships a local `lazydev-search` MCP service so third-party model routes can still perform web search without switching providers.

### 🪶 Less terminal noise

The desktop installer wires **Rust Token Killer (RTK)** into the workflow. RTK reduces noisy command output before it reaches the model; its upstream project reports up to 90% fewer terminal-output tokens on supported commands. That is output reduction, not a promise about total API cost.

## Supported providers

Lazy Developer currently exposes these provider choices in `lazydev setup`:

| Provider | Discovery | Key required | Routing |
| --- | --- | ---: | --- |
| OpenRouter | Live catalog | Yes | Local compatibility proxy |
| Gemini | Live catalog | Yes | Native Google GenAI |
| NVIDIA | Live catalog | Yes | Local compatibility proxy |
| OpenAI | Live catalog | Yes | Native OpenAI |
| Ollama Local | Local running models | No | Local compatibility proxy |
| LLM7 | Live catalog | Yes | Local compatibility proxy |
| Groq | Live catalog | Yes | Local compatibility proxy |
| CodeBuddy | Live catalog / fallback endpoints | Yes | Local compatibility proxy |
| Anthropic | Live catalog | Yes | Native Anthropic |

Provider APIs and model availability change over time, so the setup screen intentionally prefers live discovery over hard-coded model catalogs.

## Install

### macOS / Linux

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

### Windows PowerShell

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

The managed installer targets **Lazy Developer 1.0.0** and **Kimi Code 2.0.0**, while keeping updates component-aware. Re-running the installer does not intentionally wipe your saved Kimi sessions or LazyDev provider configuration.

### Termux / Android

Kimi Code's Linux binary expects a glibc Linux userland, so a practical Termux setup is a Debian or Ubuntu guest through `proot-distro`:

```bash
pkg update
pkg install proot-distro
proot-distro install debian
proot-distro login debian
```

Then run the normal Lazy Developer installer inside the Linux guest.

For standalone artifacts, the runtime keeps the platform-specific path:

```text
Native Linux    → $HOME/lazydevfile
Termux + proot  → /storage/emulated/0/lazydevfile
```

## Quick start

```bash
lazydev setup
lazydev chat
```

That is the whole basic workflow:

```text
install → setup → chat
```

Useful commands:

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

## Login & logout

Lazy Developer deliberately keeps the native Kimi Code authentication flow visible.

Inside the Kimi Code TUI:

```text
/login
```

opens the native platform/account selector.

```text
/logout
```

opens the native logout selector.

The important separation is that **Kimi authentication and LazyDev inference routing are different state machines**. Kimi Code stores OAuth credentials in its own data area, while Lazy Developer writes its selected provider and model into the LazyDev runtime configuration. A small auth bridge watches for the native config reload triggered by login/logout and restores only the LazyDev-owned routing state.

The bridge writes the restored config atomically, so Kimi Code does not have to read a half-written TOML file during a reload.

This design follows Kimi Code's current configuration model: providers and models are stored in `KIMI_CODE_HOME/config.toml`, while native login/logout manages the provider authentication state.

## Session compatibility

Kimi Code persists sessions under `KIMI_CODE_HOME/sessions/`, including session metadata and the main agent's wire history.

Lazy Developer does not rewrite those session files during normal model switching. Instead, launch-time compatibility aliases can map an older LazyDev model alias such as:

```text
lazydev/old-model-name
```

to the currently configured provider/model.

That matters because model changes should not turn old conversations into dead ends.

## Recovering strict-provider 400 errors

A particularly annoying class of errors looks like:

```text
[provider.api_error] 400
```

followed by a message about missing `tool_call_id` responses or an invalid assistant message.

Kimi Code has documented several session-recovery bugs in this area, especially after an interrupted tool call or an aborted turn.

Lazy Developer adds an extra boundary for its OpenAI-compatible proxy routes: before a request is forwarded, the proxy removes orphan tool results and incomplete assistant tool calls while preserving completed tool-call/tool-result pairs. This gives strict upstream providers a valid message sequence even when an interrupted session left a damaged tail in the projected history.

The proxy also preserves upstream error bodies where available and produces an explicit diagnostic when an upstream server returns a bare HTTP error with no body.

Kimi Code itself has continued shipping fixes for interrupted sessions, tool-call pairing, and context reconstruction, so the bundled Kimi version remains an important part of the overall behavior.

## Why `KIMI_MODEL_*` is not forced everywhere

Kimi Code supports the `KIMI_MODEL_*` environment-variable family as a temporary in-memory provider/model override. It is useful for explicit runtime wiring, but it is not the only way to configure a model.

Lazy Developer uses the normal `config.toml` provider/model configuration as the source of truth for direct Gemini, OpenAI, and Anthropic routes. Compatibility-proxy routes may use a temporary runtime override as an additional guard against native auth reloads replacing the loopback provider.

This keeps direct providers on their native Kimi Code protocol while still protecting proxy-backed providers during `/login` and `/logout` reloads.

## Web search architecture

```text
Kimi Code WebSearch
       │
       ├── available → use it
       │
       └── unavailable
              │
              ▼
       lazydev-search MCP
              │
              ▼
        search_web tool
```

The local MCP service is configured automatically in `KIMI_CODE_HOME/mcp.json`. It runs as a stdio process and does not require a second server to be kept open by the user.

## Artifact safety

Lazy Developer has a dedicated artifact path policy for standalone deliverables.

The rules are intentionally simple:

```text
1. use the canonical artifact directory
2. accept a filename, not an arbitrary path
3. never overwrite an existing file
4. add the lowest available numeric suffix
5. verify the final path before reporting success
```

This applies generically across file extensions; it is not tied to a specific task or filename.

## Cross-platform paths

The runtime includes explicit handling for desktop Linux, macOS, Windows, Termux, and Linux guests running through `proot-distro`.

| Platform | Artifact directory |
| --- | --- |
| Linux / macOS | `$HOME/lazydevfile` |
| Windows | `%USERPROFILE%\\lazydevfile` |
| Termux + proot | `/storage/emulated/0/lazydevfile` |

The project keeps native Linux artifact behavior intact while making the Termux/proot path deterministic.

## Project layout

```text
.
├── agents/             # LazyDev agent profile
├── commands/           # reusable command prompts
├── hooks/              # path, shell, and prompt guards
├── runtime/            # routing, search, policy, compatibility helpers
├── scripts/             # CLI + tests + smoke checks
├── skills/             # bundled LazyDev skills
├── assets/              # project artwork
├── install.sh           # macOS / Linux / Termux installer
├── install.ps1          # Windows installer
├── README.md
└── LICENSE
```

## Quality gates

The repository is intentionally test-heavy for a small CLI layer. The default test suite covers configuration, provider boundaries, authentication routing, session compatibility, MCP startup, artifact collision safety, path guards, installer behavior, platform detection, skills, token budgets, and repository metadata.

Run it locally with:

```bash
npm test
```

CI runs the same project-native checks on GitHub Actions.

## Contributing

Small, focused pull requests are welcome. The easiest contributions are bug fixes, provider compatibility updates, documentation improvements, tests, and reproducible issue reports.

Before opening a PR:

```bash
npm test
```

For bugs, include the operating system, Node.js version, Lazy Developer version, Kimi Code version, active provider/model, and the smallest reproducible example that does **not** expose API keys or OAuth credentials.

## Security

Never commit:

```text
API keys
OAuth tokens
session exports containing secrets
provider credentials
private workspace data
```

Read `SECURITY.md` before reporting sensitive issues.

## Troubleshooting

### `Model: not set` after `/login` or `/logout`

Start a fresh `lazydev chat` process after updating to version 1.0.0. The auth bridge restores the LazyDev provider/model after native auth reloads, while Kimi Code's own OAuth flow remains intact.

### `[provider.api_error] 400`

For proxy-backed providers, version 1.0.0 repairs incomplete OpenAI tool-call history before forwarding it. For direct providers, inspect the active provider/model first with `lazydev doctor` and retry in a new session if the previous turn was interrupted.

Kimi Code documents session data and replay as a persistent subsystem; interrupted tool exchanges have been a known source of strict-provider 400 failures.

### Live model catalog fails

Run `lazydev setup` again and check the provider endpoint/key. Cloud providers can change model availability or rate limits without notice. For Ollama, make sure the local Ollama service is running and reachable from the same Linux environment.

### Termux cannot start Kimi Code

Use a glibc Linux userland through `proot-distro` and run the installer from inside it. The runtime will still keep standalone artifacts on the shared Android path.

## Updating

Re-run the normal installer:

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/install.ps1")))
```

The installer is component-aware and does not treat every run as a destructive reinstall.

## Uninstalling

**macOS / Linux**

```bash
curl -fsSL "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.sh" | sh
```

**Windows PowerShell**

```powershell
& ([scriptblock]::Create((irm "https://raw.githubusercontent.com/BlizPS/lazy-developer-free-kimi-code/main/uninstall.ps1")))
```

## Community

This project grows fastest when people share real compatibility findings. Issues are useful for bugs and reproducible failures; Discussions are better for ideas, workflow experiments, and provider setup notes.

- 💬 [Open a Discussion](https://github.com/BlizPS/lazy-developer-free-kimi-code/discussions)
- 🐛 [Report a Bug](https://github.com/BlizPS/lazy-developer-free-kimi-code/issues/new)
- ⭐ [Star the Repository](https://github.com/BlizPS/lazy-developer-free-kimi-code/stargazers)

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>Built by <strong>BlizPS</strong> · Lazy Developer 1.0.0</sub>
</div>
