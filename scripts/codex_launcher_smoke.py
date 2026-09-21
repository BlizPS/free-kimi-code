#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTALL = ROOT / "install.sh"
LAZY = ROOT / "cli" / "lazydev.py"


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL: {msg}")


def main() -> None:
    shell = INSTALL.read_text(encoding="utf-8")
    lazy = LAZY.read_text(encoding="utf-8")

    if "LAZYDEV_CODEX_USE_TMUX" in lazy:
        fail("LazyDev still exposes a tmux Codex fallback")
    if "new-session" in lazy or "codex-lazydev" in lazy:
        fail("LazyDev still contains an active tmux Codex launcher")
    if "tmux is not installed; launching directly" in shell:
        fail("installer still contains the old tmux launcher message")
    if 'mv -f "$temp_binary" "$CODEX_BIN_DIR/codex"' not in shell:
        fail("official Codex archive is not installed at the canonical codex path")
    if "restore_codex_from_legacy_wrapper" not in shell:
        fail("legacy Codex wrapper migration is missing")

    start = shell.index("restore_codex_from_legacy_wrapper() {")
    end = shell.index("\n}\n\ninstall_codex_official()", start) + 2
    fn = shell[start:end]
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        wrapper = root / "codex"
        real = root / "codex.bin"
        wrapper.write_text("#!/bin/sh\necho 'Codex TUI compatibility: tmux is not installed; launching directly.'\n", encoding="utf-8")
        wrapper.chmod(0o755)
        real.write_text("#!/bin/sh\necho 'codex-cli 0.155.1'\n", encoding="utf-8")
        real.chmod(0o755)
        qroot = str(root).replace("'", "'\"'\"'")
        script = r"""
set -eu
CODEX_BIN_DIR='__ROOT__'
extract_semver() { printf '%s\n' "$1" | sed -n 's/.*\([0-9]\+\.[0-9]\+\.[0-9]\+\).*/\1/p' | head -n1; }
say() { :; }
__FN__
restore_codex_from_legacy_wrapper
[ -x "$CODEX_BIN_DIR/codex" ]
[ ! -e "$CODEX_BIN_DIR/codex.bin" ]
grep -q 'codex-cli 0.155.1' "$CODEX_BIN_DIR/codex"
""".replace("__ROOT__", qroot).replace("__FN__", fn)
        subprocess.run(["sh", "-c", script], check=True)

    print("PASS: Codex is direct-only; legacy tmux shadow launchers are repaired to the official binary")


if __name__ == "__main__":
    main()
