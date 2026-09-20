# LazyDev RTK + Context Policy

LazyDev uses the native RTK hook for shell output when RTK is installed. RTK is responsible for command-specific filtering; LazyDev adds a separate rolling context governor so model context does not accumulate stale tool output.

Targets:

- Terminal-output reduction: up to 90% on supported/common commands, measured as output bytes delivered to the model.
- Proactive context pruning: begin around 60% usage.
- Compaction target: 75% usage.
- Preserve the model-declared native context window; do not fake a smaller model window.
- Preserve recent turns, exact errors, paths, URLs, identifiers, and explicit verbose flags.
- Archive large pruned tool outputs locally so they can be re-read without rerunning the command.

RTK savings are workload-dependent. Never report a fabricated 90% saving when the actual command did not achieve it. A filtered result must retain an actionable recovery path when output is truncated or elided; do not silently discard diagnostic detail.
