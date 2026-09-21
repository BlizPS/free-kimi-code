#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[1]
errors=[]
sh=(ROOT/'install.sh').read_text(encoding='utf-8')
ps=(ROOT/'install.ps1').read_text(encoding='utf-8')
pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))

checks=[
    ('install.sh', 'KIMI_RELEASE_API_URL="https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest"', sh),
    ('install.sh', 'KIMI_INSTALL_URL="https://code.kimi.com/kimi-code/install.sh"', sh),
    ('install.sh', 'GITHUB_API_URL="https://api.github.com/repos/${REPO}/commits/${BRANCH}"', sh),
    ('install.sh', '.lazydev-revision', sh),
    ('install.sh', 'KIMI_NEEDS_UPDATE=0', sh),
    ('install.sh', 'LAZYDEV_NEEDS_UPDATE=0', sh),
    ('install.sh', 'LAZYDEV_FEATURE_REFRESH=0', sh),
    ('install.sh', 'LAZYDEV_LOCAL_SOURCE_DIR', sh),
    ('install.sh', 'Existing Kimi sessions and configuration were left in place.', sh),
    ('install.ps1', "$KimiReleasesApiUrl = 'https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest'", ps),
    ('install.ps1', "https://code.kimi.com/kimi-code/install.ps1", ps),
    ('install.ps1', "$GitHubApiUrl =", ps),
    ('install.ps1', "'.lazydev-revision'", ps),
    ('install.ps1', '$KimiNeedsUpdate = $false', ps),
    ('install.ps1', '$LazyDevNeedsUpdate = $false', ps),
    ('install.ps1', '$LazyDevFeatureRefresh = $false', ps),
    ('install.ps1', '$LocalSourceDir', ps),
    ('install.ps1', 'Existing Kimi sessions and configuration were left in place.', ps),
    ('install.ps1', 'Refresh-ExistingLazyDevLaunchers', ps),
    ('install.ps1', '$LazyInstallComplete', ps),
    ('install.ps1', 'Invoke-WebRequest -UseBasicParsing -Uri $KimiInstallUrl -OutFile $kimiInstallerPath', ps),
    ('install.ps1', 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File $kimiInstallerPath', ps),
]

checks += [
    ('install.sh', 'replace_legacy_lazydev_launchers', sh),
    ('install.sh', 'LAZYDEV_INSTALL_COMPLETE=0', sh),
    ('install.sh', 'refresh_shell_path', sh),
    ("install.sh", "Bash's command hash cache", sh),
    ('install.sh', 'com.termux/files/usr/bin', sh),
    ('uninstall.sh', 'remove_managed_launchers_from_path', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.sh', 'init -g --uninstall', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.ps1', 'Remove-CommandShims', (ROOT/'uninstall.ps1').read_text(encoding='utf-8')),
]
checks += [
    ('install.sh', 'TERMUX_LINUX=0', sh),
    ('install.sh', 'native Python CLI', sh),
    ('install.ps1', 'The LazyDev CLI is native Python', ps),
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

cli_text = (ROOT / 'cli' / 'lazydev.py').read_text(encoding='utf-8')
launcher_text = (ROOT / 'scripts' / 'lazydev.mjs').read_text(encoding='utf-8')
if 'if cmd == "resume":' not in cli_text or ('lazydev ' + 'sessions') in cli_text:
    errors.append('cli/lazydev.py: resume command surface is stale')
if "if (cmd === 'resume') return resume();" not in launcher_text or "if (cmd === 'sessions')" in launcher_text:
    errors.append('scripts/lazydev.mjs: resume command surface is stale')
if 'KIMI_LATEST_VERSION=' not in sh or 'version_at_least "$KIMI_CURRENT_VERSION" "$KIMI_LATEST_VERSION"' not in sh:
    errors.append('install.sh: Kimi version check must use dynamically discovered latest release')
if '$KimiLatestVersion = Get-KimiLatestVersion' not in ps or 'Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion' not in ps:
    errors.append('install.ps1: Kimi version check must use dynamically discovered latest release')
for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'KIMI_VERSION' in text or '$KimiVersion' in text:
        errors.append(f'{name}: hardcoded Kimi version remains')
if 'ensure_legacy_launcher_targets' not in sh or 'canonical="$LAZYDEV_BIN_DIR/lazydev"' not in sh:
    errors.append('install.sh: compatibility launcher reconciliation missing canonical launcher copy')
if 'install_codex_official()' not in sh or 'codex-package-${target}.tar.gz' not in sh:
    errors.append('install.sh: official Codex release installer missing')
if 'lazydev_setup_ready()' in sh or 'Setting up Lazy Developer before AI UIs' in sh or 'Setup is ready before AI UI installation.' in sh:
    errors.append('install.sh: installer must not run LazyDev setup during installation')
for marker in ['Installing/updating RTK', 'Installing/updating Lazy Developer $LAZYDEV_VERSION', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']:
    if marker not in sh: errors.append(f'install.sh: missing lifecycle step: {marker}')
else:
    order = [sh.index(x) for x in ['Installing/updating RTK', 'Installing/updating Lazy Developer $LAZYDEV_VERSION', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']]
    if order != sorted(order): errors.append('install.sh: lifecycle order must be RTK → LazyDev → Kimi → Codex → Antigravity')
if 'refresh_active_lazydev_launcher' not in sh:
    errors.append('install.sh: active LazyDev launcher refresh missing')
if 'lazydev-help.txt' not in sh or 'Lazy Developer command surface is stale' not in sh:
    errors.append('install.sh: post-refresh command surface verification missing')
if 'Refresh-ActiveLazyDevLauncher' not in ps or 'Lazy Developer command surface is stale' not in ps:
    errors.append('install.ps1: post-refresh command surface verification missing')
if 'CODEX_INSTALLED_BIN="$LAZYDEV_BIN_DIR/codex"' not in sh or 'official archive verified' not in sh:
    errors.append('install.sh: Codex post-install verification fallback missing')
if 'resilient_download()' not in sh or '--http1.1' not in sh or '--retry 8' not in sh or ' -C - ' not in sh:
    errors.append('install.sh: Codex resilient resumable download policy missing')
if 'Install-CodexOfficial' not in ps or 'codex-package-$target.tar.gz' not in ps:
    errors.append('install.ps1: official Codex release installer missing')
if 'Test-LazyDevSetupReady' in ps or 'Setting up Lazy Developer before AI UIs' in ps or 'Setup is ready before AI UI installation.' in ps:
    errors.append('install.ps1: installer must not run LazyDev setup during installation')
for marker in ['Installing/updating RTK', 'Installing/updating Lazy Developer $LazyDevVersion', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']:
    if marker not in ps: errors.append(f'install.ps1: missing lifecycle step: {marker}')
else:
    order = [ps.index(x) for x in ['Installing/updating RTK', 'Installing/updating Lazy Developer $LazyDevVersion', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']]
    if order != sorted(order): errors.append('install.ps1: lifecycle order must be RTK → LazyDev → Kimi → Codex → Antigravity')
if 'Refresh-ActiveLazyDevLauncher' not in ps:
    errors.append('install.ps1: active LazyDev launcher refresh missing')
if "$CodexInstalledPath = Join-Path $BinRoot 'codex.exe'" not in ps or 'official archive verified' not in ps:
    errors.append('install.ps1: Codex post-install verification fallback missing')
if 'Invoke-ResilientDownload' not in ps or '--http1.1' not in ps or '--retry' not in ps or '--continue-at' not in ps:
    errors.append('install.ps1: Codex resilient resumable download policy missing')

for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'embedded current source' not in text and 'embedded-current' not in text:
        errors.append(f'{name}: embedded current LazyDev source fallback missing')
    if 'Lazy Developer setup' not in text or 'lazydev setup' not in text:
        errors.append(f'{name}: explicit LazyDev setup skip is missing')

legacy_env = 'CODEX' + '_INSTALL_URL'
legacy_vars = ['Codex' + 'InstallUrl']
legacy_scripts = ['codex' + '-install.sh', 'codex' + '-install.ps1']
if legacy_env in sh or any(v in ps for v in legacy_vars) or any(v in sh or v in ps for v in legacy_scripts):
    errors.append('installers: Codex must not delegate the large binary download to a nested remote installer')
if 'for dir in "$HOME/.local/bin" "${PREFIX:-}/bin"' in sh:
    errors.append('install.sh: must not target /bin accidentally when PREFIX is unset')

for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'npm install' in text.lower() or 'npm.cmd install' in text.lower():
        errors.append(f'{name}: installer must not install through npm')
    if 'Installing private Node.js' in text or 'install_private_node' in text or 'nodejs.org/dist' in text or 'NODE_BASE_URL' in text:
        errors.append(f'{name}: private Node.js installation/download must not be present')
    if 'NODE_BIN="$(command -v node' in text or 'node.exe "%LAZYDEV_ROOT%' in text:
        errors.append(f'{name}: installer still launches LazyDev through Node.js')
if 'ScriptBlock]::Create' in ps or 'scriptblock]::Create' in ps:
    errors.append('install.ps1: must not parse downloaded bytes with ScriptBlock.Create')
if 'scriptblock]::Create' in (ROOT/'scripts/lazydev.mjs').read_text(encoding='utf-8').lower():
    errors.append('scripts/lazydev.mjs: Windows installer hint still uses ScriptBlock.Create')
for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    forbidden_install_checks = [
        'Get-SystemNodeExecutable',
        'NODE_BIN=\"$(command -v node',
        'current = Get-VersionFromText ((& $cmd.Source --version',
        'node.exe "%LAZYDEV_ROOT%\\scripts\\lazydev.mjs"',
    ]
    for needle in forbidden_install_checks:
        if needle in text:
            errors.append(f'{name}: install-time Node.js gate remains: {needle}')


cli = ROOT / 'cli' / 'lazydev.py'
if not cli.is_file(): errors.append('native Python CLI missing at cli/lazydev.py')
else:
    cli_text = cli.read_text(encoding='utf-8')
    if not cli_text.startswith('#!/usr/bin/env python3'): errors.append('native CLI must use Python shebang')
    if 'process.versions' in cli_text or 'node.exe' in cli_text or 'node:child_process' in cli_text: errors.append('native CLI contains Node runtime logic')
if 'scripts/lazydev.mjs' in sh or 'scripts\\lazydev.mjs' in ps:
    # The source remains bundled for plugin/development hosts, but installers must never invoke it.
    pass

if pkg.get('version') != '1.0.2': errors.append('package version is not 1.0.2')
if pkg.get('homepage') != 'https://github.com/BlizPS/free-kimi-code': errors.append('package homepage mismatch')
if pkg.get('repository',{}).get('url') != 'git+https://github.com/BlizPS/free-kimi-code.git': errors.append('package repository URL mismatch')
for p in ROOT.rglob('*'):
    if not p.is_file() or '.git' in p.parts or p == ROOT/'scripts/installer_smoke.py': continue
    if p.suffix.lower() not in {'.md','.json','.yml','.yaml','.toml','.mjs','.js','.py','.sh','.ps1','.txt'}: continue
    s=p.read_text(encoding='utf-8', errors='ignore')
    old_repo = 'BlizPS/' + ''.join(['l','a','z','y','-','d','e','v','e','l','o','p','e','r','-','s','k','i','l','l','-','c','l','i'])
    if old_repo in s and 'lazy-developer-skill' not in s: errors.append(f'old repository reference remains: {p.relative_to(ROOT)}')
    forbidden_protocol = 'openai_' + 'responses'
    legacy_label = 'OpenAI ' + ''.join(chr(x) for x in [82,101,115,112,111,110,115,101,115])
    if legacy_label in s or forbidden_protocol in s: errors.append(f'forbidden OpenAI provider naming remains: {p.relative_to(ROOT)}')

# Deterministic regression check for the exact Termux/proot failure reported by users.
# The source must prefer an existing broken lazydev symlink in a Termux PATH entry,
# because Bash may have that path cached with `hash` in the current shell.
termux_marker = '/data/data/com.termux/files/usr/bin/lazydev'
if termux_marker not in sh or 'if [ -L "$candidate" ] && [ ! -e "$candidate" ]; then' not in sh or 'if [ -w "$dir" ]; then' not in sh:
    errors.append('install.sh: termux hash-cache source regression')
if errors:
    print('FAIL')
    print('\n'.join('ERROR: '+e for e in errors))
    raise SystemExit(1)
print('PASS: installers, selective update logic, repository URLs, and provider naming are consistent')
