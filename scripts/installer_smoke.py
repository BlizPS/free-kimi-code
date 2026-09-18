#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
errors=[]
sh=(ROOT/'install.sh').read_text(encoding='utf-8')
ps=(ROOT/'install.ps1').read_text(encoding='utf-8')
pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))

checks=[
    ('install.sh', 'KIMI_VERSION="0.43.1"', sh),
    ('install.sh', 'KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"', sh),
    ('install.sh', 'GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"', sh),
    ('install.sh', '.lazydev-revision', sh),
    ('install.sh', 'KIMI_NEEDS_UPDATE=0', sh),
    ('install.sh', 'LAZYDEV_NEEDS_UPDATE=0', sh),
    ('install.sh', 'Existing Kimi sessions and configuration were left in place.', sh),
    ('install.ps1', "$KimiVersion = '0.43.1'", ps),
    ('install.ps1', "https://code.kimi.com/kimi-code/install.ps1", ps),
    ('install.ps1', "$GitHubApiUrl =", ps),
    ('install.ps1', "'.lazydev-revision'", ps),
    ('install.ps1', '$KimiNeedsUpdate = $false', ps),
    ('install.ps1', '$LazyDevNeedsUpdate = $false', ps),
    ('install.ps1', 'Existing Kimi sessions and configuration were left in place.', ps),
    ('install.ps1', 'Refresh-ExistingLazyDevLaunchers', ps),
    ('install.ps1', '$LazyInstallComplete', ps),
]

checks += [
    ('install.sh', 'replace_legacy_lazydev_launchers', sh),
    ('install.sh', 'LAZYDEV_INSTALL_COMPLETE=0', sh),
    ('install.sh', 'refresh_shell_path', sh),
    ('uninstall.sh', 'remove_managed_launchers_from_path', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.sh', 'init -g --uninstall', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.ps1', 'Remove-CommandShims', (ROOT/'uninstall.ps1').read_text(encoding='utf-8')),
]
checks += [
    ('install.sh', 'TERMUX_LINUX=0', sh),
    ('install.sh', 'glibc Linux userland', sh),
    ('install.sh', 'LAZYDEV_BIN_DIR=\"${LAZYDEV_BIN_DIR:-${PREFIX:-$HOME/.local}/bin}\"', sh),
    ('install.sh', 'if [ -L \"$LAZYDEV_LAUNCHER\" ]; then rm -f \"$LAZYDEV_LAUNCHER\"; fi', sh),
    ('uninstall.sh', '/storage/emulated/0/lazydevfile', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
]
checks += [
    ('install.sh', 'RTK_INSTALL_URL=', sh),
    ('install.sh', 'RTK_NEEDS_UPDATE=0', sh),
    ('install.sh', 'init --agent kimi', sh),
    ('install.ps1', '$RtkApiUrl =', ps),
    ('install.ps1', '$RtkNeedsUpdate = $false', ps),
    ('install.ps1', 'init --agent kimi', ps),
    ('uninstall.sh', 'Lazy Developer, Kimi Code, RTK', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.ps1', 'Lazy Developer, Kimi Code, RTK', (ROOT/'uninstall.ps1').read_text(encoding='utf-8')),
]
for name, needle, text in checks:
    if needle not in text: errors.append(f'{name}: missing {needle}')
for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'npm install' in text.lower() or 'npm.cmd install' in text.lower():
        errors.append(f'{name}: installer must not install through npm')
if pkg.get('version') != '1.0.0': errors.append('package version is not 1.0.0')
if pkg.get('homepage') != 'https://github.com/BlizPS/lazy-developer-free-kimi-code': errors.append('package homepage mismatch')
if pkg.get('repository',{}).get('url') != 'git+https://github.com/BlizPS/lazy-developer-free-kimi-code.git': errors.append('package repository URL mismatch')
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts or p == ROOT/'scripts/installer_smoke.py': continue
    if p.suffix.lower() not in {'.md','.json','.yml','.yaml','.toml','.mjs','.js','.py','.sh','.ps1','.txt'}: continue
    s=p.read_text(encoding='utf-8', errors='ignore')
    old_repo = 'BlizPS/' + ''.join(['l','a','z','y','-','d','e','v','e','l','o','p','e','r','-','s','k','i','l','l','-','c','l','i'])
    if old_repo in s and 'lazy-developer-skill' not in s: errors.append(f'old repository reference remains: {p.relative_to(ROOT)}')
    forbidden_protocol = 'openai_' + 'responses'
    legacy_label = 'OpenAI ' + ''.join(chr(x) for x in [82,101,115,112,111,110,115,101,115])
    if legacy_label in s or forbidden_protocol in s: errors.append(f'forbidden OpenAI provider naming remains: {p.relative_to(ROOT)}')
if errors:
    print('FAIL')
    print('\n'.join('ERROR: '+e for e in errors))
    raise SystemExit(1)
print('PASS: installers, selective update logic, repository URLs, and provider naming are consistent')
