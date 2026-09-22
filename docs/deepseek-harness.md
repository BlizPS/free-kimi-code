# DeepSeek Harness with Free Kimi Code

DeepSeek Harness is the fifth coding surface in Free Kimi Code. Unlike the terminal CLIs, it runs as a local Web UI, so it appears in `lazydev chat` but not `lazydev resume`.

## Install

Run the Free Kimi Code installer and answer `Y` when it reaches the final choice:

```text
Kimi Code → Codex → Antigravity → Claude Code → DeepSeek Harness
```

Then configure the active route and launch it:

```sh
lazydev setup
lazydev chat
```

## Web UI

When DeepSeek Harness is selected, LazyDev:

1. creates an isolated Harness home;
2. synchronizes the four LazyDev skills;
3. creates a local configuration overlay;
4. connects the Harness model adapter to the LazyDev loopback proxy;
5. starts the Web UI on `127.0.0.1`; and
6. opens the local URL when a browser launcher is available.

The launcher prints the exact local address when the Web UI is ready. The service is bound to loopback rather than a network interface.

## Model routing

The Web UI uses the current model selected by `lazydev setup`. The browser-facing model identity is kept stable as `Sonnet`, while the real provider/model route remains inside LazyDev. This prevents provider-specific IDs from becoming persistent Harness session identities.

## Termux / Android

Use LazyDev from the Debian or Ubuntu guest described in the main README. Android/Termux uses the known compatible Harness runtime path instead of the newer release family that introduced native file-locking requirements on `android-arm64`.

## Resume behavior

DeepSeek Harness is intentionally absent from:

```sh
lazydev resume
```

Harness sessions remain inside its local Web UI workspace.

## Troubleshooting

Run:

```sh
lazydev doctor
```

Check that DeepSeek Harness is detected and that the displayed version matches the platform-specific compatibility path. For Web UI startup issues, see [Troubleshooting](troubleshooting.md).
