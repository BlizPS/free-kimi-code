#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
errors=[]
sh=(ROOT/'install.sh').read_text(encoding='utf-8')
ps=(ROOT/'install.ps1').read_text(encoding='utf-8')
pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
for p in ('install.sh','install.ps1'):
    if not (ROOT/p).is_file(): errors.append(f'missing {p}')
checks=[
    ('install.sh', 'KIMI_VERSION="0.43.1"', sh),
    ('install.sh', 'https://code.kimi.com/kimi-code/install.sh', sh),
    ('install.sh', 'NODE_VERSION="22.19.0"', sh),
    ('install.sh', 'cu' + 'rl -fsSL "$REPO_ARCHIVE_URL"', sh),
    ('install.ps1', "$KimiVersion = '0.43.1'", ps),
    ('install.ps1', 'https://code.kimi.com/kimi-code/install.ps1', ps),
    ('install.ps1', "$NodeVersion = '22.19.0'", ps),
    ('install.ps1', '$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"', ps),
]

for name, needle, text in checks:
    if needle not in text: errors.append(f'{name}: missing {needle}')
for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'npm install' in text.lower() or 'npm.cmd install' in text.lower():
        errors.append(f'{name}: installer must not install through npm')
if pkg.get('homepage') != 'https://github.com/BlizPS/lazy-developer-skill-cli': errors.append('package homepage still points at old repository')
if pkg.get('repository',{}).get('url') != 'git+https://github.com/BlizPS/lazy-developer-skill-cli.git': errors.append('package repository URL mismatch')
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts or p == ROOT/'scripts/installer_smoke.py': continue
    if p.suffix.lower() not in {'.md','.json','.yml','.yaml','.toml','.mjs','.js','.py','.sh','.ps1','.txt'}: continue
    s=p.read_text(encoding='utf-8', errors='ignore')
    if re.search(r'BlizPS/lazy-developer-skill(?!-cli)', s):
        errors.append(f'old repository reference remains: {p.relative_to(ROOT)}')
if errors:
    print('FAIL')
    print('\n'.join('ERROR: '+e for e in errors))
    raise SystemExit(1)
print('PASS: installers, repository URLs, and legacy launcher references are consistent')
