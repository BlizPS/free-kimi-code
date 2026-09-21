#!/usr/bin/env python3
from pathlib import Path
import os, subprocess, tempfile

ROOT = Path(__file__).resolve().parents[1]
sh = (ROOT / 'install.sh').read_text(encoding='utf-8')
py = (ROOT / 'cli' / 'lazydev.py').read_text(encoding='utf-8')

assert 'write_codex_android_wrapper()' not in sh
assert 'install_codex_android_wrapper()' not in sh
assert "exec tmux -f /dev/null" not in sh
assert "['tmux', '-f', '/dev/null'" not in py
assert 'command = [codex, *args]' in py
assert 'CODEX_INSTALL_URL="https://chatgpt.com/codex/install.sh"' in sh
assert 'if ! sh "$script" >"$log" 2>&1; then' in sh
assert 'CODEX_INSTALLED_BIN="$CODEX_BIN_DIR/codex"' in sh
assert 'codex.bin' in sh  # only legacy migration/detection, never a public replacement

# Exercise the legacy wrapper migration in an isolated shell.
with tempfile.TemporaryDirectory() as td:
    t = Path(td)
    bin_dir = t / 'bin'; bin_dir.mkdir()
    real = bin_dir / 'codex.bin'
    wrapper = bin_dir / 'codex'
    real.write_text('#!/bin/sh\nprintf "codex 0.155.1\\n"\n')
    real.chmod(0o755)
    wrapper.write_text('#!/bin/sh\necho "Codex TUI compatibility: tmux"\nexec tmux -f /dev/null new-session -A -s codex-lazydev "$@"\n')
    wrapper.chmod(0o755)
    # Extract just the function body between repair_legacy_codex_wrappers and find_codex.
    a = sh.index('repair_legacy_codex_wrappers() {')
    b = sh.index('\nfind_codex() {', a)
    fn = sh[a:b]
    harness = t / 'test.sh'
    harness.write_text(f'''#!/bin/sh\nset -eu\nCODEX_BIN_DIR="{bin_dir}"\nDEFAULT_EXTERNAL_BIN_DIR="{bin_dir}"\nHOME="{t}"\nLAZYDEV_HOME="{t}/lazydev"\nLAZYDEV_BIN_DIR="{bin_dir}"\nPREFIX=""\nsay() {{ printf '%s\n' "$*"; }}\n{fn}\nrepair_legacy_codex_wrappers\n[ -x "{bin_dir}/codex" ]\n! grep -Eq 'tmux|codex-lazydev|Codex TUI compatibility' "{bin_dir}/codex"\n"{bin_dir}/codex" --version\n''')
    harness.chmod(0o755)
    out = subprocess.run([str(harness)], text=True, capture_output=True, check=True)
    assert 'codex 0.155.1' in out.stdout

print('PASS: Codex direct-only regression and legacy wrapper recovery')
