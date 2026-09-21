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

    # Codex must remain the native executable. LazyDev may configure routing,
    # but it must not expose or invoke the old tmux launcher.
    if "LAZYDEV_CODEX_USE_TMUX" in lazy or "LAZYDEV_CODEX_USE_TMUX" in shell:
        fail("LazyDev still exposes a tmux Codex fallback")
    if "new-session" in lazy or "new-session" in shell or "codex-lazydev" in lazy:
        fail("LazyDev still contains an active tmux Codex launcher")
    if "tmux is not installed; launching directly" in shell:
        fail("installer still contains the old tmux launcher message")

    for needle in (
        'CODEX_BIN_DIR="${CODEX_BIN_DIR:-$DEFAULT_EXTERNAL_BIN_DIR}"',
        "install_codex_official() {",
        "repair_legacy_codex_wrappers() {",
        'CODEX_INSTALLED_BIN="$CODEX_BIN_DIR/codex"',
        "Codex official installer failed.",
    ):
        if needle not in shell:
            fail(f"Codex installer contract is missing: {needle}")

    start = shell.index("repair_legacy_codex_wrappers() {")
    end = shell.index("\n}\n\n\nfind_codex()", start) + 2
    fn = shell[start:end]

    with tempfile.TemporaryDirectory() as td:
        home = Path(td)
        canonical_dir = home / ".local" / "bin"
        official_dir = home / ".codex" / "packages" / "standalone" / "current" / "bin"
        canonical_dir.mkdir(parents=True)
        official_dir.mkdir(parents=True)

        wrapper = canonical_dir / "codex"
        official = official_dir / "codex"
        wrapper.write_text(
            "#!/bin/sh\necho 'Codex TUI compatibility: tmux is not installed; launching directly.'\n",
            encoding="utf-8",
        )
        wrapper.chmod(0o755)
        official.write_text("#!/bin/sh\necho 'codex-cli 0.155.1'\n", encoding="utf-8")
        official.chmod(0o755)

        script = r"""
set -eu
HOME='__HOME__'
DEFAULT_EXTERNAL_BIN_DIR="$HOME/.local/bin"
CODEX_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR"
LAZYDEV_HOME="$HOME/.local/share/lazydev"
LAZYDEV_BIN_DIR="$DEFAULT_EXTERNAL_BIN_DIR"
say() { :; }
__FN__
repair_legacy_codex_wrappers
[ -x "$CODEX_BIN_DIR/codex" ]
[ ! -f "$CODEX_BIN_DIR/codex.bin" ]
grep -q 'codex-cli 0.155.1' "$CODEX_BIN_DIR/codex"
case "$(readlink "$CODEX_BIN_DIR/codex" 2>/dev/null || true)" in
  *".codex/packages/standalone/current/bin/codex") ;;
  *) echo "FAIL: canonical Codex path does not point to the official binary" >&2; exit 1 ;;
esac
if grep -q 'tmux' "$CODEX_BIN_DIR/codex"; then
  echo "FAIL: canonical Codex path still contains the legacy wrapper" >&2
  exit 1
fi
"""
        quoted_home = str(home).replace("'", "'\"'\"'")
        script = script.replace("__HOME__", quoted_home).replace("__FN__", fn)
        subprocess.run(["sh", "-c", script], check=True)

    print("PASS: Codex stays native/direct; legacy tmux wrappers migrate back to the official executable")


if __name__ == "__main__":
    main()
