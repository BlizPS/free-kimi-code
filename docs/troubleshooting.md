# Free Kimi Code — Troubleshooting

Common fixes for Kimi Code, Codex CLI, Antigravity CLI, Claude Code, and DeepSeek Harness.

## Claude Code says the background service cannot be reached

On Linux user-namespace environments, run Claude through LazyDev so it can probe a mapped namespace automatically:

```sh
lazydev chat
```

LazyDev prefers `unshare -Ur` when the current process has no usable UID map. When the kernel blocks that operation, the background daemon feature is disabled instead of repeatedly surfacing the socket ownership warning. Foreground chat and `lazydev resume` remain available.

## Claude Code says a session model is not recognized

LazyDev exposes a stable native model alias to Claude Code and keeps the real provider/model route behind the local proxy. New LazyDev-managed sessions therefore use the stable alias instead of a provider-specific ID.

For an older session created before this behavior was enabled, start a fresh session once with `lazydev chat`; future LazyDev-managed turns use the current routing identity.

## LazyDev skills are missing in Claude Code

Run:

```sh
lazydev chat
```

LazyDev synchronizes the four bundled skills into `~/.claude/skills/` without replacing existing user skills. The same canonical skills remain available through the shared `.agents/skills` tree.

## Claude Code is missing from the CLI picker

Re-run the installer and answer `Y` when asked to install Claude Code or refresh its installation. The native picker order is:

```text
1. Kimi Code
2. Codex
3. Antigravity
4. Claude Code
5. DeepSeek Harness
```

DeepSeek Harness appears only in `lazydev chat`, not `lazydev resume`.

Then run `lazydev chat` again.

## Providers or models look stale

Run:

```sh
lazydev setup
```

The provider/model catalog is intentionally discovered at setup time instead of being frozen in the documentation.

## DeepSeek Harness fails on Android / Termux

Run it from the Debian or Ubuntu guest. LazyDev selects the Android-compatible Harness release path instead of the newer builds that require unsupported native file locking on `android-arm64`.

## DeepSeek Harness Web UI does not open

Run:

```sh
lazydev doctor
lazydev chat
```

The Harness is bound to `127.0.0.1`. If no browser launcher is available, copy the printed local URL into your browser.
