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
    ('install.sh', 'Kimi sessions and saved configuration are preserved', sh),
    ('install.ps1', "$KimiVersion = '0.43.1'", ps),
    ('install.ps1', "https://code.kimi.com/kimi-code/install.ps1", ps),
    ('install.ps1', "$GitHubApiUrl =", ps),
    ('install.ps1', "'.lazydev-revision'", ps),
    ('install.ps1', '$KimiNeedsUpdate = $false', ps),
    ('install.ps1', '$LazyDevNeedsUpdate = $false', ps),
    ('install.ps1', 'Kimi sessions and saved configuration are preserved', ps),
]
for name, needle, text in checks:
    if needle not in text: errors.append(f'{name}: missing {needle}')
for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'npm install' in text.lower() or 'npm.cmd install' in text.lower():
        errors.append(f'{name}: installer must not install through npm')
if pkg.get('version') != '1.0.0': errors.append('package version is not 1.0.0')
if pkg.get('homepage') != 'https://github.com/BlizPS/lazy-developer-skill-cli': errors.append('package homepage mismatch')
if pkg.get('repository',{}).get('url') != 'git+https://github.com/BlizPS/lazy-developer-skill-cli.git': errors.append('package repository URL mismatch')
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts or p == ROOT/'scripts/installer_smoke.py': continue
    if p.suffix.lower() not in {'.md','.json','.yml','.yaml','.toml','.mjs','.js','.py','.sh','.ps1','.txt'}: continue
    s=p.read_text(encoding='utf-8', errors='ignore')
    if re.search(r'BlizPS/lazy-developer-skill(?!-cli)', s): errors.append(f'old repository reference remains: {p.relative_to(ROOT)}')
    forbidden_protocol = 'openai_' + 'responses'
    if ('OpenAI ' + 'Responses') in s or forbidden_protocol in s: errors.append(f'forbidden OpenAI provider naming remains: {p.relative_to(ROOT)}')
if errors:
    print('FAIL')
    print('\n'.join('ERROR: '+e for e in errors))
    raise SystemExit(1)
print('PASS: installers, selective update logic, repository URLs, and provider naming are consistent')
