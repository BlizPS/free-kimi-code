#!/usr/bin/env python3
import os, pathlib, subprocess, tempfile, textwrap

ROOT = pathlib.Path(__file__).resolve().parents[1]
script = ROOT / 'uninstall.sh'

with tempfile.TemporaryDirectory(prefix='lazydev-uninstall-smoke-') as td:
    home = pathlib.Path(td) / 'home'
    bin_dir = home / '.local' / 'bin'
    config = home / '.config' / 'lazydev'
    kimi = config / 'kimi-code'
    native_kimi = home / '.kimi-code'
    legacy_kimi = home / '.kimi'
    rtk_cfg = home / '.config' / 'rtk'
    rtk_data = home / '.local' / 'share' / 'rtk'
    rtk_cache = home / '.cache' / 'rtk'
    artifact = home / 'lazydevfile'
    fake_old = home / 'old-bin'
    for d in [bin_dir, kimi, native_kimi, legacy_kimi, rtk_cfg, rtk_data, rtk_cache, artifact, fake_old]:
        d.mkdir(parents=True, exist_ok=True)
    (config / 'config.json').write_text('{"providers":{"openai":{"apiKey":"old","model":"old"}}}\n')
    (kimi / 'session_index.jsonl').write_text('{"id":"session"}\n')
    (native_kimi / 'session_index.jsonl').write_text('{"id":"native-session"}\n')
    (artifact / 'example.txt').write_text('x')
    (rtk_cfg / 'config.toml').write_text('[rtk]\n')
    (rtk_data / 'x').write_text('x')
    (rtk_cache / 'x').write_text('x')

    # Managed LazyDev launchers: one direct, one symlink target, one old PATH entry.
    canonical = bin_dir / 'lazydev'
    canonical.write_text('# Lazy Developer managed launcher\nexec node /tmp/lazydev/scripts/lazydev.mjs "$@"\n')
    old_target = fake_old / 'lazydev-target'
    old_target.write_text('#!/bin/sh\n# old lazydev scripts/lazydev.mjs\n')
    os.chmod(old_target, 0o755)
    old_link = fake_old / 'lazydev'
    old_link.symlink_to(old_target)
    # Kimi and RTK shims in the managed bin.
    kimi_shim = bin_dir / 'kimi'
    kimi_shim.write_text('#!/bin/sh\n# @moonshot-ai/kimi-code\n')
    os.chmod(kimi_shim, 0o755)
    rtk_shim = bin_dir / 'rtk'
    rtk_shim.write_text('#!/bin/sh\n# rtk-ai/rtk Rust Token Killer\nif [ "$1" = gain ]; then exit 0; fi\nexit 0\n')
    os.chmod(rtk_shim, 0o755)

    # Make pgrep always report no running process; keep normal system PATH tools available.
    fake_pgrep = fake_old / 'pgrep'
    fake_pgrep.write_text('#!/bin/sh\nexit 1\n')
    os.chmod(fake_pgrep, 0o755)

    env = os.environ.copy()
    env['HOME'] = str(home)
    env['XDG_CONFIG_HOME'] = str(home / '.config')
    env['PATH'] = f'{bin_dir}:{fake_old}:' + env.get('PATH','')
    env['SHELL'] = '/bin/bash'
    result = subprocess.run(['sh', str(script)], env=env, text=True, capture_output=True, timeout=30)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit('FAIL: uninstall.sh smoke test returned non-zero')
    leftovers = [p for p in [config, native_kimi, legacy_kimi, rtk_cfg, rtk_data, rtk_cache, artifact, canonical, old_link, kimi_shim, rtk_shim] if p.exists() or p.is_symlink()]
    if leftovers:
        print(result.stdout)
        raise SystemExit('FAIL: uninstall left managed paths: ' + ', '.join(map(str,leftovers)))

print('PASS: uninstall.sh removes LazyDev, Kimi Code, RTK, legacy launchers, sessions, caches, and artifacts')
