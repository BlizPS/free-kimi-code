# Free Kimi Code — Claude Code Integration

Free Kimi Code connects Claude Code to the same Lazy Developer route used by the other native CLIs while preserving the native Claude Code interface.

## Start

```sh
lazydev setup
lazydev chat
```

Choose **Claude Code** from the native CLI picker. The configured provider and model route is reused automatically.

## Sessions

```sh
lazydev resume
```

The resume picker includes Claude Code and keeps the native continuation flow. LazyDev exposes a stable native model alias to Claude Code so provider-specific model IDs are not written into the session identity.

## Termux and Android

Some Claude Code builds from the `2.1.248`–`2.1.251` range contain a Linux user-namespace regression that can reject the background daemon before it starts. The upstream report documents the empty `uid_map` detection problem and notes that an explicit messaging socket alone does not bypass it: [issue #90908](https://github.com/anthropics/claude-code/issues/90908).

LazyDev now probes `unshare -Ur` when the current process has no usable UID mapping. When that mapped namespace is available, Claude keeps its background/session messaging path. When the kernel does not allow it, LazyDev disables the background feature group instead of repeating the daemon ownership warning; normal chat and `lazydev resume` remain available.

## Session model identity

LazyDev keeps the configured provider model as its internal route while exposing the stable native `sonnet` alias to Claude Code. The proxy also returns that alias in Claude-facing model responses, which prevents provider-specific model IDs from becoming the model identity of newly created sessions.

Existing sessions created before this compatibility layer may still contain an older provider-specific model identity; starting a new LazyDev-managed Claude session uses the stable alias.

## Skills

Lazy Developer's bundled skills are synchronized to Claude Code's user skill directory at `~/.claude/skills/`. Existing user skills are preserved.

See [Skills](skills.md) for the shared skill layout. For common Claude Code startup, session, and skills problems, see [Troubleshooting](troubleshooting.md).
