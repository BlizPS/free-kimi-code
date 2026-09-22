#!/usr/bin/env python3
from pathlib import Path
import sys, tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "cli"))
import lazydev as mod

assert mod.VERSION == "1.0.3"
assert mod.CLAUDE_EXPOSED_MODEL_ALIAS == "sonnet"
assert mod.CLAUDE_ANDROID_MESSAGING_BUG_MIN == (2, 1, 248)
assert mod.CLAUDE_ANDROID_MESSAGING_BUG_MAX == (2, 1, 251)
source = (ROOT / "cli" / "lazydev.py").read_text(encoding="utf-8")
assert '["--model", CLAUDE_EXPOSED_MODEL_ALIAS]' in source
assert 'env["ANTHROPIC_MODEL"] = CLAUDE_EXPOSED_MODEL_ALIAS' in source
assert 'env["LAZYDEV_CLAUDE_SKILLS_DIR"]' in source
assert 'def _ensure_claude_skills' in source
assert 'def _claude_unshare_prefix' in source
assert 'env["DISABLE_GROWTHBOOK"] = "1"' in source
assert 'uid_mapping_missing = sys.platform.startswith("linux")' in source
assert 'subprocess.call([*unshare_prefix, claude, *args]' in source

old_termux, old_platform, old_uid = mod.IS_TERMUX, mod.sys.platform, mod._claude_uid_mapping_available
try:
    mod.IS_TERMUX = True
    mod.sys.platform = "linux"
    mod._claude_uid_mapping_available = lambda: False
    with tempfile.TemporaryDirectory() as td:
        fake = Path(td) / "claude"
        fake.write_text("#!/bin/sh\nprintf '2.1.251\n'\n", encoding="utf-8")
        fake.chmod(0o755)
        assert mod._claude_android_messaging_workaround_needed(str(fake)) is True
        prefix = mod._claude_unshare_prefix()
        if mod.shutil.which("unshare"):
            assert prefix[:2] == [mod.shutil.which("unshare"), "-Ur"], prefix

    # Real skill installation contract: never replace ~/.claude/skills, but add
    # every bundled LazyDev skill there for Claude Code discovery.
    with tempfile.TemporaryDirectory() as td_home:
        old_home = mod.HOME
        mod.HOME = Path(td_home)
        try:
            shared = mod._ensure_shared_skill_root()
            mod._ensure_claude_skills(shared)
            target = mod.HOME / ".claude" / "skills"
            expected = {name for name, _ in mod.SKILLS}
            assert expected.issubset({p.name for p in target.iterdir()}), sorted(target.iterdir())
        finally:
            mod.HOME = old_home
finally:
    mod.IS_TERMUX, mod.sys.platform, mod._claude_uid_mapping_available = old_termux, old_platform, old_uid

print("PASS: Claude model alias, LazyDev skill sync, and Android messaging regression guard")
