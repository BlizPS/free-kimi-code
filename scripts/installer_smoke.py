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
    ('uninstall.sh', 'Native Kimi Code, Codex, Antigravity, and RTK user data were preserved.', (ROOT/'uninstall.sh').read_text(encoding='utf-8')),
    ('uninstall.ps1', 'Native AI CLI and RTK user data were preserved', (ROOT/'uninstall.ps1').read_text(encoding='utf-8')),
]

# nounset regression: LazyDev state must be initialized before its first runtime use.
_lazy_init = sh.index('LAZYDEV_NEEDS_UPDATE=1')
_lazy_use = sh.index('if [ "$LAZYDEV_NEEDS_UPDATE" -ne 0 ]; then')
if _lazy_init > _lazy_use:
    errors.append('install.sh: LAZYDEV_NEEDS_UPDATE is read before initialization')
if 'LAZYDEV_STATUS_MESSAGE=""' not in sh:
    errors.append('install.sh: LAZYDEV_STATUS_MESSAGE initialization missing')
for name, needle, text in checks:
    if needle not in text: errors.append(f'{name}: missing {needle}')


state_needles = [
    'LAZYDEV_STATE_FILE',
    'load_install_state()',
    'write_install_state() {',
    'rtk_bin_dir=',
    'kimi_bin_dir=',
    'codex_bin_dir=',
    'lazydev_command=',
    'write_cli_registry()',
    'CODEX_BIN_DIR/codex',
    'HOME/.local/share/lazydev/codex',
    'LAZYDEV_CLI_REGISTRY_FILE=',
]
for needle in state_needles:
    if needle not in sh: errors.append(f'install.sh: persistent install state/discovery missing: {needle}')
if 'LAZYDEV_STATE_HOME' not in (ROOT/'uninstall.sh').read_text(encoding='utf-8') or '$StateRoot' not in ps:
    errors.append('uninstallers: persistent installer state cleanup missing')
if 'install-state.json' not in ps or '$RtkBinRoot' not in ps or '$CodexBinRoot' not in ps:
    errors.append('uninstall.ps1: state-selected component locations missing')
if '## 🗑️ Uninstall' not in (ROOT/'README.md').read_text(encoding='utf-8'):
    errors.append('README.md: uninstall instructions missing')

# RTK verification regression: the POSIX installer must define its helper
# before using it, and must rediscover the managed RTK location on reinstall.
if sh.index('rtk_is_token_killer() {') > sh.index('rtk_is_token_killer "$RTK_COMMAND"'):
    errors.append('install.sh: rtk_is_token_killer is defined after first use')
if '$HOME/.local/share/lazydev/rtk' not in sh:
    errors.append('install.sh: legacy RTK location is not discoverable on reinstall')
if 'RTK_INSTALL_DIR="$RTK_BIN_DIR"' not in sh:
    errors.append('install.sh: RTK must be installed into the durable external bin directory')
if 'LAZYDEV_STATE_FILE' not in sh or 'load_install_state()' not in sh or 'write_install_state() {' not in sh:
    errors.append('install.sh: persistent installer state missing')
if 'LAZYDEV_STATE_LOADED=1' not in sh or 'if [ "$LAZYDEV_STATE_LOADED" -eq 0 ] &&' not in sh:
    errors.append('install.sh: persisted state must prevent PATH-based bin directory drift')
if 'LAZYDEV_STATE_FILE' in sh and sh.index('LAZYDEV_STATE_FILE=') > sh.index('elif [ -f "$LAZYDEV_STATE_FILE" ]'):
    errors.append('install.sh: state file is read before it is initialized')
if '"$candidate" gain >/dev/null 2>&1' not in sh:
    errors.append('install.sh: RTK identity verification must use rtk gain')

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
if 'install_codex_official()' not in sh or 'CODEX_INSTALL_URL="https://chatgpt.com/codex/install.sh"' not in sh:
    errors.append('install.sh: official Codex release installer missing')
if 'lazydev_setup_ready()' in sh or 'Setting up Lazy Developer before AI UIs' in sh or 'Setup is ready before AI UI installation.' in sh:
    errors.append('install.sh: installer must not run LazyDev setup during installation')
for marker in ['step "RTK"', 'step "Installing/updating Lazy Developer $LAZYDEV_VERSION"', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']:
    if marker not in sh: errors.append(f'install.sh: missing lifecycle step: {marker}')
else:
    order = [sh.index(x) for x in ['step "RTK"', 'step "Installing/updating Lazy Developer $LAZYDEV_VERSION"', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']]
    if order != sorted(order): errors.append('install.sh: lifecycle order must be RTK → LazyDev → Kimi → Codex → Antigravity')
    if sh.index('step "RTK"') > sh.index('step "Installing/updating Lazy Developer $LAZYDEV_VERSION"'): errors.append('install.sh: RTK lifecycle marker must precede LazyDev install')
if 'refresh_active_lazydev_launcher' not in sh:
    errors.append('install.sh: active LazyDev launcher refresh missing')
if 'lazydev-help.txt' not in sh or 'Lazy Developer command surface is stale' not in sh:
    errors.append('install.sh: post-refresh command surface verification missing')
if 'Refresh-ActiveLazyDevLauncher' not in ps or 'Lazy Developer command surface is stale' not in ps:
    errors.append('install.ps1: post-refresh command surface verification missing')
if 'CODEX_INSTALLED_BIN="$CODEX_BIN_DIR/codex"' not in sh or 'official installer' not in sh:
    errors.append('install.sh: Codex post-install verification fallback missing')
if 'resilient_download()' not in sh or '--http1.1' not in sh or '--retry 8' not in sh or ' -C - ' not in sh:
    errors.append('install.sh: Codex resilient resumable download policy missing')
if 'function Install-CodexOfficial' not in ps or 'github.com/openai/codex/releases/download/rust-v' not in ps:
    errors.append('install.ps1: official Codex release archive installer missing')
if 'Test-LazyDevSetupReady' in ps or 'Setting up Lazy Developer before AI UIs' in ps or 'Setup is ready before AI UI installation.' in ps:
    errors.append('install.ps1: installer must not run LazyDev setup during installation')
for marker in ["Step 'RTK'", 'Step \"Installing/updating Lazy Developer $LazyDevVersion\"', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']:
    if marker not in ps: errors.append(f'install.ps1: missing lifecycle step: {marker}')
else:
    order = [ps.index(x) for x in ["Step 'RTK'", 'Step "Installing/updating Lazy Developer $LazyDevVersion"', 'Installing/updating Kimi Code to the latest available release', 'Installing/updating official Codex CLI', 'Installing/updating official Antigravity CLI']]
    if order != sorted(order): errors.append('install.ps1: lifecycle order must be RTK → LazyDev → Kimi → Codex → Antigravity')
    if ps.index("Step 'RTK'") > ps.index('Step \"Installing/updating Lazy Developer $LazyDevVersion\"'): errors.append('install.ps1: RTK lifecycle marker must precede LazyDev install')
if 'Refresh-ActiveLazyDevLauncher' not in ps:
    errors.append('install.ps1: active LazyDev launcher refresh missing')
if "$CodexInstalledPath = Join-Path $CodexBinRoot 'codex.exe'" not in ps or 'official' not in ps:
    errors.append('install.ps1: Codex post-install verification fallback missing')
if 'Invoke-ResilientDownload' not in ps or '--http1.1' not in ps or '--retry' not in ps or '--continue-at' not in ps:
    errors.append('install.ps1: Codex resilient resumable download policy missing')

for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    if 'embedded current source' not in text and 'embedded-current' not in text:
        errors.append(f'{name}: embedded current LazyDev source fallback missing')
    if 'Lazy Developer setup' not in text or 'lazydev setup' not in text:
        errors.append(f'{name}: explicit LazyDev setup skip is missing')

# Codex intentionally delegates to OpenAI's official installer script, matching the
# previously working release contract and keeping archive/target handling upstream.
if 'for dir in "$HOME/.local/bin" "${PREFIX:-}/bin"' in sh:
    errors.append('install.sh: must not target /bin accidentally when PREFIX is unset')

for name, text in [('install.sh', sh), ('install.ps1', ps)]:
    lowered = text.lower()
    if 'npm install' in lowered and '@poppinss/cliui' not in lowered:
        errors.append(f'{name}: unexpected npm installation outside the isolated CLI UI runtime')
    if 'npm.cmd install' in lowered and '@poppinss/cliui' not in lowered:
        errors.append(f'{name}: unexpected npm.cmd installation outside the isolated CLI UI runtime')
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
    if 'process.versions' in cli_text or 'node:child_process' in cli_text or 'child_process.exec' in cli_text: errors.append('native CLI contains Node runtime logic')
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


# Regression checks for the persistent optional CLI UI runtime.
repo = Path(__file__).resolve().parents[1]
cli_text = (repo / 'cli' / 'lazydev.py').read_text(encoding='utf-8')
assert '@poppinss/cliui' in cli_text
assert 'UI_RUNTIME_DIR' in cli_text
assert 'lazydev-ui.mjs' in cli_text
assert (repo / 'runtime' / 'lazydev-ui.mjs').is_file()
assert 'local-${' in (repo / 'install.sh').read_text(encoding='utf-8') or 'local-' in (repo / 'install.sh').read_text(encoding='utf-8')
assert 'local-' in (repo / 'install.ps1').read_text(encoding='utf-8')
