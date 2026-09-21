# Compatibility

Lazy Developer has two sides: the built-in CLI experience and a portable skills/plugin layer.

## LazyDev CLI

The built-in chat flow uses Kimi Code as its agent shell. Configure your provider, credentials, and model with `lazydev setup`, then start with:

```bash
lazydev chat
```

Available providers and models are detected through the current Lazy Developer setup. Run:

```bash
lazydev setup
```

to view the providers, models, credentials, and capabilities available in your environment.

## Other Coding Agents

Use the universal Skills CLI when you want to use Lazy Developer's skills inside another compatible coding agent:

```bash
npx skills add BlizPS/free-kimi-code --all
```

For a specific target supported by the Skills CLI:

```bash
npx skills add BlizPS/free-kimi-code --agent claude-code
```

LazyDev already bundles its own skills, so this universal installation is intended for other compatible agents, not for `lazydev chat`.

## Plugins and Extensions

Native integration metadata is included for compatible coding-agent ecosystems.

Use each host's standard plugin or extension installation flow to enable Lazy Developer where supported.

## Platforms

Lazy Developer supports runtime environments including:

- Windows
- Linux
- macOS
- Termux

The one-line desktop installer targets Windows, Linux, and macOS.

Kimi Code's current native installation flow does not provide a dedicated Android/Termux installation path, so Termux users should use the supported runtime and setup flow provided by Lazy Developer.

## Native CLI Data

LazyDev does not relocate official CLI application data into `lazydevfile` on desktop operating systems. Windows, Linux, and macOS keep Kimi, Codex, Antigravity, and Claude Code data in their normal user-home locations. The `lazydevfile` directory is for the shared visible workspace/artifacts.

The only special storage exception is native Termux and Debian/Ubuntu through PRoot: visible artifacts use `/storage/emulated/0/lazydevfile`, while Codex keeps `CODEX_HOME` on the native Linux filesystem when needed for app-server locks, sockets, and related OS primitives.


### Codex TUI on Android/Termux

OpenAI currently documents Codex CLI for supported desktop/Linux environments rather than native Android. LazyDev keeps the official Codex binary unchanged and launches it directly; it never replaces `codex` with a direct execution wrapper.
