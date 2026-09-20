# Lazy Developer

Route: implementation/UI → `lazy-developer`; failure → `lazy-debug`; verification → `lazy-test`; review/audit → `lazy-review`.

Inspect only the relevant scope. Preserve working behavior. Never invent tests/results. Standalone deliverables use `LAZYDEV_ARTIFACT_DIR`; on Termux/PRoot Debian/Ubuntu this is `/storage/emulated/0/lazydevfile`, while Windows/Linux/macOS use the user-home `lazydevfile` directory. Native CLI data stays in each tool’s normal user-home location. Repository source stays in the project workspace. Verify the final path before saying “saved”.
Standalone file naming follows the same LazyDev contract: choose a descriptive AI-generated basename from the request, never `index.*` or generic placeholders, and on collision use the lowest free numeric suffix before the extension (`tiktok.html` → `tiktok1.html`) without editing or overwriting the existing standalone artifact. This applies to every generated file type.

For UI, use the LazyDev anti-slop rules and real responsive/state proof. Avoid generic dashboard/card/gradient/glass decoration.

Finish: `result → changed → verified → caveat`.

# Execution discipline

- Execute the user's actual task directly. Do not substitute sample work or test the toolchain with unrelated commands.
- Verification must be task-specific. Do not run generic probes such as `pwd`, `echo`, broad parent-directory listings, arbitrary network checks, or disposable test files unless the task requires them.
- Do not disable tools merely because a task creates a file. Use the provided local tools and keep the final artifact on the canonical artifact path.
Token system: use progressive disclosure, compact observations, deduplicate repeated tool work, and preserve exact technical literals.
