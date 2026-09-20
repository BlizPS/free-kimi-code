from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime.platform_paths import is_termux_environment, platform_paths

assert platform_paths('linux', {}, Path('/home/alice'), lambda _: False)['artifactDirectory'] == Path('/home/alice/lazydevfile')
assert platform_paths('darwin', {}, Path('/Users/alice'), lambda _: False)['artifactDirectory'] == Path('/Users/alice/lazydevfile')
win_path = platform_paths('win32', {'USERPROFILE': r'C:\Users\alice'}, Path('/fallback'), lambda _: False)['artifactDirectory']
assert str(win_path).replace('\\', '/') == 'C:/Users/alice/lazydevfile'
assert platform_paths('linux', {'TERMUX_VERSION': '1'}, Path('/root'), lambda _: False)['artifactDirectory'] == Path('/storage/emulated/0/lazydevfile')
assert platform_paths('linux', {}, Path('/root'), lambda x: x in {'/storage/emulated/0', '/data/data/com.termux/files/usr'})['artifactDirectory'] == Path('/storage/emulated/0/lazydevfile')
assert platform_paths('linux', {}, Path('/home/alice'), lambda x: x == '/storage/emulated/0')['artifactDirectory'] == Path('/home/alice/lazydevfile')
print('PASS: Python canonical paths for Windows, macOS, Linux, Termux, and proot-distro')
