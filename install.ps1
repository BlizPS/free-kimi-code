param([switch]$Help)

# Windows PowerShell 5.1 is the minimum supported host.

# This file intentionally has no UTF-8 BOM because it is commonly piped through ScriptBlock::Create.
if ($PSVersionTable.PSVersion -lt [version]'5.1') {
    throw 'PowerShell 5.1 or newer is required.'
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Test-SafePath([string]$Path, [string]$Type = 'Any') {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    try {
        if ($Type -eq 'Leaf') { return (Test-Path -LiteralPath $Path -PathType Leaf) }
        if ($Type -eq 'Container') { return (Test-Path -LiteralPath $Path -PathType Container) }
        return (Test-SafePath $Path)
    } catch { return $false }
}

$Repo = 'BlizPS/free-kimi-code'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }

# Prefer bundled source when this script is executed from an extracted archive.
$LocalSourceDir = if ($env:LAZYDEV_SOURCE_DIR) { $env:LAZYDEV_SOURCE_DIR } elseif ($PSScriptRoot -and (Test-SafePath (Join-Path $PSScriptRoot 'package.json') 'Leaf') -and (Test-SafePath (Join-Path $PSScriptRoot 'cli\lazydev.py') 'Leaf')) { $PSScriptRoot } else { '' }
$LazyDevVersion = '1.0.3'
$KimiInstallUrl = 'https://code.kimi.com/kimi-code/install.ps1'
$ClaudeInstallUrl = 'https://claude.ai/install.ps1'
$AntigravityInstallUrl = 'https://antigravity.google/cli/install.ps1'
$KimiReleasesApiUrl = 'https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest'
$CodexReleasesApiUrl = 'https://api.github.com/repos/openai/codex/releases/latest'
$AntigravityReleasesApiUrl = 'https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest'
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$GitHubApiUrl = "https://api.github.com/repos/$Repo/commits/$Branch"
$RtkApiUrl = 'https://api.github.com/repos/rtk-ai/rtk/releases/latest'
$RtkInstallRepo = 'https://github.com/rtk-ai/rtk'
$InstallRoot = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$ConfigRoot = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $env:APPDATA 'lazydev' }
$DeepSeekHarnessPackage = '@deepseek-ai/dsh'
$DeepSeekHarnessDesktopVersion = if ($env:LAZYDEV_DSH_VERSION) { $env:LAZYDEV_DSH_VERSION } else { '0.1.5-rc.2' }
$DeepSeekHarnessRuntime = if ($env:LAZYDEV_DSH_RUNTIME) { $env:LAZYDEV_DSH_RUNTIME } else { Join-Path $ConfigRoot 'deepseek-harness-runtime' }
$DeepSeekHarnessHome = if ($env:LAZYDEV_DSH_HOME) { $env:LAZYDEV_DSH_HOME } else { Join-Path $ConfigRoot 'deepseek-harness-home' }
$StateRoot = if ($env:XDG_STATE_HOME) { Join-Path $env:XDG_STATE_HOME 'lazydev' } else { Join-Path $HOME '.local\state\lazydev' }
$StateFile = Join-Path $StateRoot 'install-state.json'
$StateBackupFile = "$StateFile.bak"
$CliRegistryFile = Join-Path $StateRoot 'cli-paths.json'
$CliRegistryBackupFile = "$CliRegistryFile.bak"
$StateLoaded = $false
$BinRoot = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }
$KimiBinRoot = Join-Path $HOME '.kimi-code\bin'
$ExternalBinRoot = Join-Path $HOME '.local\bin'
$RtkBinRoot = $ExternalBinRoot
$CodexBinRoot = $ExternalBinRoot
if (-not $env:LAZYDEV_BIN_DIR -and -not (Test-SafePath $StateFile 'Leaf')) {
    foreach ($candidate in @((Join-Path $HOME '.local\share\lazydev\bin'), (Join-Path $HOME '.local\share\lazydev'), (Join-Path $HOME '.local\bin'))) {
        if ((Test-SafePath (Join-Path $candidate 'lazydev.cmd') 'Leaf') -or
            (Test-SafePath (Join-Path $candidate 'rtk.exe') 'Leaf') -or
            (Test-SafePath (Join-Path $candidate 'codex.exe') 'Leaf')) {
            $BinRoot = $candidate
            $RtkBinRoot = $candidate
            $CodexBinRoot = $candidate
            break
        }
    }
}
$PersistedKimiCommand = ''
$PersistedCodexCommand = ''
$PersistedAntigravityCommand = ''
$PersistedClaudeCommand = ''
$PersistedDeepSeekHarnessCommand = ''
$PersistedRtkCommand = ''
$PersistedUiRuntimeDir = ''
if (-not $env:LAZYDEV_BIN_DIR -and (Test-SafePath $StateFile 'Leaf')) {
    try {
        $state = Get-Content -Raw -LiteralPath $StateFile | ConvertFrom-Json
        if ($state.bin_dir) { $BinRoot = [string]$state.bin_dir; $StateLoaded = $true }
        if ($state.kimi_bin_dir) { $KimiBinRoot = [string]$state.kimi_bin_dir }
        if ($state.rtk_bin_dir -and ([string]$state.rtk_bin_dir) -notlike ($InstallRoot + '*')) { $RtkBinRoot = [string]$state.rtk_bin_dir }
        if ($state.codex_bin_dir -and ([string]$state.codex_bin_dir) -notlike ($InstallRoot + '*')) { $CodexBinRoot = [string]$state.codex_bin_dir }
        if ($state.kimi_command) { $PersistedKimiCommand = [string]$state.kimi_command }
        if ($state.codex_command) { $PersistedCodexCommand = [string]$state.codex_command }
        if ($state.antigravity_command) { $PersistedAntigravityCommand = [string]$state.antigravity_command }
        if ($state.claude_command) { $PersistedClaudeCommand = [string]$state.claude_command }
        if ($state.deepseek_harness_command) { $PersistedDeepSeekHarnessCommand = [string]$state.deepseek_harness_command }
        if ($state.rtk_command) { $PersistedRtkCommand = [string]$state.rtk_command }
        if ($state.ui_runtime_dir) { $PersistedUiRuntimeDir = [string]$state.ui_runtime_dir }
    } catch {}
}
# A backup state is retained so transient PATH/detector failures cannot erase
# the last known-good CLI locations.
if (Test-SafePath $StateBackupFile 'Leaf') {
    try {
        $backup = Get-Content -Raw -LiteralPath $StateBackupFile | ConvertFrom-Json
        if (-not $PersistedKimiCommand -and $backup.kimi_command) { $PersistedKimiCommand = [string]$backup.kimi_command }
        if (-not $PersistedCodexCommand -and $backup.codex_command) { $PersistedCodexCommand = [string]$backup.codex_command }
        if (-not $PersistedAntigravityCommand -and $backup.antigravity_command) { $PersistedAntigravityCommand = [string]$backup.antigravity_command }
        if (-not $PersistedClaudeCommand -and $backup.claude_command) { $PersistedClaudeCommand = [string]$backup.claude_command }
        if (-not $PersistedDeepSeekHarnessCommand -and $backup.deepseek_harness_command) { $PersistedDeepSeekHarnessCommand = [string]$backup.deepseek_harness_command }
        if (-not $PersistedRtkCommand -and $backup.rtk_command) { $PersistedRtkCommand = [string]$backup.rtk_command }
        if (-not $PersistedUiRuntimeDir -and $backup.ui_runtime_dir) { $PersistedUiRuntimeDir = [string]$backup.ui_runtime_dir }
    } catch {}
}
if ((Test-SafePath $CliRegistryFile 'Leaf') -or (Test-SafePath $CliRegistryBackupFile 'Leaf')) {
    foreach ($registryPath in @($CliRegistryFile, $CliRegistryBackupFile)) {
        if (-not (Test-SafePath $registryPath 'Leaf')) { continue }
        try {
            $registry = Get-Content -Raw -LiteralPath $registryPath | ConvertFrom-Json
            if (-not $PersistedKimiCommand -and $registry.kimi_command) { $PersistedKimiCommand = [string]$registry.kimi_command }
            if (-not $PersistedCodexCommand -and $registry.codex_command) { $PersistedCodexCommand = [string]$registry.codex_command }
            if (-not $PersistedAntigravityCommand -and $registry.antigravity_command) { $PersistedAntigravityCommand = [string]$registry.antigravity_command }
            if (-not $PersistedClaudeCommand -and $registry.claude_command) { $PersistedClaudeCommand = [string]$registry.claude_command }
            if (-not $PersistedDeepSeekHarnessCommand -and $registry.deepseek_harness_command) { $PersistedDeepSeekHarnessCommand = [string]$registry.deepseek_harness_command }
            if (-not $PersistedRtkCommand -and $registry.rtk_command) { $PersistedRtkCommand = [string]$registry.rtk_command }
        } catch {}
    }
}

if ($BinRoot -eq $InstallRoot -or $BinRoot -like ($InstallRoot + '\\*')) { $BinRoot = Join-Path $HOME '.local\bin' }
$RtkBinRoot = if ($RtkBinRoot -eq $InstallRoot -or $RtkBinRoot -like ($InstallRoot + '\\*')) { $ExternalBinRoot } else { $RtkBinRoot }
$CodexBinRoot = if ($CodexBinRoot -eq $InstallRoot -or $CodexBinRoot -like ($InstallRoot + '\\*')) { $ExternalBinRoot } else { $CodexBinRoot }

$KimiRuntimeHome = Join-Path $ConfigRoot 'kimi-code'
$LazyDevUiHome = if ($env:LAZYDEV_UI_RUNTIME) { $env:LAZYDEV_UI_RUNTIME } elseif ($PersistedUiRuntimeDir) { $PersistedUiRuntimeDir } else { Join-Path $ConfigRoot 'ui-runtime' }
$LazyDevUiPackage = '@poppinss/cliui'
$LazyDevUiVersion = '6.8.1'
function Get-GitHubRevision {
    $headers = @{ Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28'; 'User-Agent'='lazy-developer-installer/1.0.3' }
    try {
        $data = Invoke-RestMethod -Headers $headers -Uri $GitHubApiUrl
        if ($data.sha -match '^[0-9a-fA-F]{40}$') { return $data.sha }
    } catch {}
    return $null
}
function Get-LazyDevSourceFingerprint([string]$SourceDir) {
    try {
        $lines = New-Object System.Collections.Generic.List[string]
        Get-ChildItem -LiteralPath $SourceDir -File -Recurse -Force |
            Where-Object { $_.FullName -notmatch '\.git([\\/]|$)' -and $_.FullName -notmatch 'node_modules([\\/]|$)' -and $_.FullName -notmatch '__pycache__([\\/]|$)' -and $_.Extension -ne '.pyc' } |
            Sort-Object FullName | ForEach-Object {
                $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
                $relative = $_.FullName.Substring($SourceDir.Length).TrimStart('\\','/')
                [void]$lines.Add($hash + '  ' + $relative)
            }
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
            return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
        } finally { $sha.Dispose() }
    } catch { return '' }
}
function Get-LazyDevLocalSourceRevision([string]$SourceDir) {
    $marker = Join-Path $SourceDir '.lazydev-source-id'
    if (Test-SafePath $marker 'Leaf') {
        try {
            $id = ((Get-Content -Raw -LiteralPath $marker) -replace '\s', '')
            if ($id) { return 'local-' + $id }
        } catch {}
    }
    return 'local-' + (Get-LazyDevSourceFingerprint $SourceDir)
}
function Get-RtkLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.3' }
        $data = Invoke-RestMethod -Headers $headers -Uri $RtkApiUrl
        if ($data.tag_name -match '^v(\d+\.\d+\.\d+)$') { return $Matches[1] }
    } catch {}
    return ''
}
function Get-KimiLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.3' }
        $data = Invoke-RestMethod -Headers $headers -Uri $KimiReleasesApiUrl
        $tag = [string]$data.tag_name
        $m = [regex]::Match($tag, '(\d+\.\d+\.\d+)$')
        if ($m.Success) { return $m.Groups[1].Value }
    } catch {}
    return ''
}
function Get-GitHubReleaseVersion([string]$ApiUrl) {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28'; 'User-Agent'='lazy-developer-installer/1.0.3' }
        $data = Invoke-RestMethod -Headers $headers -Uri $ApiUrl
        $tag = [string]$data.tag_name
        $m = [regex]::Match($tag, '(\d+\.\d+\.\d+)$')
        if ($m.Success) { return $m.Groups[1].Value }
    } catch {}
    return ''
}
function Get-CodexLatestVersion { return Get-GitHubReleaseVersion $CodexReleasesApiUrl }

function Get-CodexReleaseTarget {
    if ($env:OS -eq 'Windows_NT') {
        $arch = $env:PROCESSOR_ARCHITECTURE
        if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
        switch ($arch.ToUpperInvariant()) {
            'ARM64' { return 'aarch64-pc-windows-msvc' }
            'AMD64' { return 'x86_64-pc-windows-msvc' }
            default { throw "Unsupported Codex Windows architecture: $arch" }
        }
    }
    throw 'This PowerShell installer path is intended for Windows.'
}

function Invoke-ResilientDownload([string]$Url, [string]$Path) {
    $dir = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) { throw 'curl.exe is required for resilient Codex downloads on Windows.' }
    $args = @('--fail','--location','--http1.1','--connect-timeout','20','--max-time','1800','--retry','8','--retry-delay','2','--retry-max-time','1800','--speed-time','90','--speed-limit','1024','--output',$Path)
    if (Test-SafePath $Path) {
        & $curl.Source @('--fail','--location','--http1.1','--connect-timeout','20','--max-time','1800','--retry','8','--retry-delay','2','--retry-max-time','1800','--speed-time','90','--speed-limit','1024','--continue-at','-','--output',$Path,$Url)
        if ($LASTEXITCODE -eq 0) { return }
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
    & $curl.Source @args $Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url" }
}

function Install-CodexOfficial([string]$Version) {
    $target = Get-CodexReleaseTarget
    $asset = "codex-package-$target.tar.gz"
    $base = "https://github.com/openai/codex/releases/download/rust-v$Version"
    $cacheRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'LazyDev\CodexCache' } else { Join-Path $HOME '.lazydev\codex-cache' }
    $versionRoot = Join-Path $cacheRoot $Version
    $archive = Join-Path $versionRoot $asset
    $sums = Join-Path $versionRoot 'codex-package_SHA256SUMS'
    $extract = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-codex-$([guid]::NewGuid().ToString('N'))")
    New-Item -ItemType Directory -Force -Path $extract | Out-Null
    try {
        Write-Host "Codex $Version · official release asset · $target"
        Write-Host 'Downloading with resumable retries (HTTP/1.1) …'
        Invoke-ResilientDownload "$base/$asset" $archive
        Invoke-ResilientDownload "$base/codex-package_SHA256SUMS" $sums
        $line = Select-String -LiteralPath $sums -Pattern ([regex]::Escape($asset)) | Select-Object -First 1
        if (-not $line) { throw "Codex checksum for $asset was not found in the official manifest." }
        $expected = ($line.Line -split '\s+')[0].ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw 'Codex package checksum mismatch; refusing to install a corrupted download.' }
        $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
        if (-not $tar) { throw 'tar.exe is required to unpack the official Codex archive.' }
        & $tar.Source -xzf $archive -C $extract
        if ($LASTEXITCODE -ne 0) { throw 'Could not unpack the official Codex archive.' }
        $binary = Get-ChildItem -LiteralPath $extract -File -Recurse | Where-Object { $_.Name -like 'codex-*' } | Select-Object -First 1
        if (-not $binary) { throw 'Official Codex archive did not contain the expected binary.' }
        New-Item -ItemType Directory -Force -Path $CodexBinRoot | Out-Null
        Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $CodexBinRoot 'codex.exe') -Force
        Remove-Item -LiteralPath $archive,$sums -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $versionRoot -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Codex $Version installed from the official release archive"
    } finally {
        Remove-Item -LiteralPath $extract -Recurse -Force -ErrorAction SilentlyContinue
    }
}
function Get-AntigravityLatestVersion { return Get-GitHubReleaseVersion $AntigravityReleasesApiUrl }
function Get-InstalledLazyVersion {
    $file = Join-Path $InstallRoot 'package.json'
    if (-not (Test-SafePath $file 'Leaf')) { return '' }
    try { return ((Get-Content -Raw -LiteralPath $file) | ConvertFrom-Json).version } catch { return '' }
}
function Get-InstalledLazyRevision {
    $file = Join-Path $InstallRoot '.lazydev-revision'
    if (-not (Test-SafePath $file 'Leaf')) { return '' }
    try { return ([IO.File]::ReadAllText($file)).Trim() } catch { return '' }
}
function Install-Rtk {
    $latest = Get-RtkLatestVersion
    if (-not $latest) { Fail 'Could not determine the latest RTK release.' }
    $archName = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $target = switch ($archName.ToUpperInvariant()) {
        'AMD64' { 'x86_64-pc-windows-msvc' }
        'ARM64' { 'aarch64-pc-windows-msvc' }
        default { Fail "Unsupported Windows architecture for RTK: $archName" }
    }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-rtk-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        $release = Invoke-RestMethod -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.3' } -Uri $RtkApiUrl
        $asset = $release.assets | Where-Object { $_.name -eq "rtk-$target.zip" } | Select-Object -First 1
        if (-not $asset) { Fail "RTK release $latest does not contain rtk-$target.zip." }
        $archive = Join-Path $tmp $asset.name
        Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $archive
        $hashAsset = $release.assets | Where-Object { $_.name -eq 'checksums.txt' } | Select-Object -First 1
        if (-not $hashAsset) { Fail 'RTK checksums.txt is missing from the release.' }
        $hashPath = Join-Path $tmp 'checksums.txt'
        Invoke-WebRequest -UseBasicParsing -Uri $hashAsset.browser_download_url -OutFile $hashPath
        $expectedLine = Get-Content -LiteralPath $hashPath | Where-Object { $_ -match [regex]::Escape($asset.name) } | Select-Object -First 1
        $expected = if ($expectedLine) { ($expectedLine -split '\s+')[0].ToUpperInvariant() } else { '' }
        if (-not $expected) { Fail "No checksum found for $($asset.name)." }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToUpperInvariant()
        if ($actual -ne $expected) { Fail 'RTK checksum verification failed.' }
        $extract = Join-Path $tmp 'extract'
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $exe = Get-ChildItem -LiteralPath $extract -Filter 'rtk.exe' -Recurse -File | Select-Object -First 1
        if (-not $exe) { Fail 'The RTK archive did not contain rtk.exe.' }
        New-Item -ItemType Directory -Path $RtkBinRoot -Force | Out-Null
        Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $RtkBinRoot 'rtk.exe') -Force
    } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
function Connect-RtkToKimi([string]$RtkExe) {
    New-Item -ItemType Directory -Path $KimiRuntimeHome -Force | Out-Null
    Step 'Connecting RTK to Kimi Code'
    Push-Location $KimiRuntimeHome
    try {
        $env:RTK_TELEMETRY_DISABLED = '1'
        & $RtkExe init --agent kimi --auto-patch
        if ($LASTEXITCODE -ne 0) { Fail "RTK Kimi integration failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
}
if ($Help) {
    $HelpText = @"
Lazy Developer installer

Installs or updates the selected Kimi Code, Codex, Antigravity, Claude Code, and DeepSeek Harness UIs, then RTK and Lazy Developer $LazyDevVersion.
The LazyDev CLI is native Python and does not require Node.js.
Run the same command again to update only components that changed.
Existing Kimi sessions are left alone during updates.
"@
    Write-Host $HelpText
    return
}

$KimiExe = Find-Kimi
$KimiCurrentVersion = Get-KimiVersion $KimiExe
$KimiLatestVersion = ''
$KimiNeedsUpdate = $true
$KimiUpdateAvailable = $false
if ($KimiExe) {
    if ($KimiCurrentVersion) {
        # Release checks are only needed for installed components.
        $KimiLatestVersion = Get-KimiLatestVersion
        if ($KimiLatestVersion) {
            if (Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion) {
                $KimiNeedsUpdate = $false
                if ($KimiCurrentVersion -eq $KimiLatestVersion) {
                    Write-Host "Kimi Code $KimiCurrentVersion is already current — skipped."
                } else {
                    Write-Host "Kimi Code $KimiCurrentVersion is newer than the latest published $KimiLatestVersion — skipped."
                }
            } else {
                $KimiUpdateAvailable = $true
                Write-Host "Kimi Code $KimiCurrentVersion → $KimiLatestVersion — update available."
            }
        } else {
            $KimiNeedsUpdate = $false
            Write-Host "Kimi Code $KimiCurrentVersion is installed; latest release could not be checked — skipped."
        }
    } else {
        $KimiNeedsUpdate = $false
        $KimiUpdateAvailable = $false
        Write-Host 'Kimi Code is installed but its version could not be detected — skipped.'
    }
} else {
    $KimiUpdateAvailable = $true
    Write-Host 'Kimi Code not found — installation available.'
}

$CodexExe = Find-Codex
if ($CodexExe -and -not $env:LAZYDEV_BIN_DIR) { $CodexBinRoot = Split-Path -Parent $CodexExe }
$CodexCurrentVersion = if ($CodexExe) { Get-VersionFromText ((& $CodexExe --version 2>$null) -join "`n") } else { '' }
$CodexLatestVersion = ''
$CodexNeedsUpdate = $true
$CodexUpdateAvailable = $false
if ($CodexExe) {
    if ($CodexCurrentVersion) {
        $CodexLatestVersion = Get-CodexLatestVersion
        if ($CodexLatestVersion) {
            if (Test-VersionAtLeast $CodexCurrentVersion $CodexLatestVersion) {
                $CodexNeedsUpdate = $false
                if ($CodexCurrentVersion -eq $CodexLatestVersion) {
                    Write-Host "Codex $CodexCurrentVersion is already current — skipped."
                } else {
                    Write-Host "Codex $CodexCurrentVersion is newer than the latest published $CodexLatestVersion — skipped."
                }
            } else {
                $CodexUpdateAvailable = $true
                Write-Host "Codex $CodexCurrentVersion → $CodexLatestVersion — update available."
            }
        } else {
            $CodexNeedsUpdate = $false
            Write-Host "Codex $CodexCurrentVersion is installed; latest release could not be checked — skipped."
        }
    } else {
        $CodexNeedsUpdate = $false
        $CodexUpdateAvailable = $false
        Write-Host 'Codex is installed but its version could not be detected — skipped.'
    }
} else {
    $CodexUpdateAvailable = $true
    Write-Host 'Codex not found — installation available.'
}

$AgyExe = Find-Antigravity
$AgyCurrentVersion = if ($AgyExe) { Get-VersionFromText ((& $AgyExe --version 2>$null) -join "`n") } else { '' }
$AgyLatestVersion = ''
$AgyNeedsUpdate = $true
$AgyUpdateAvailable = $false
if ($AgyExe) {
    if ($AgyCurrentVersion) {
        $AgyLatestVersion = Get-AntigravityLatestVersion
        if ($AgyLatestVersion) {
            if (Test-VersionAtLeast $AgyCurrentVersion $AgyLatestVersion) {
                $AgyNeedsUpdate = $false
                if ($AgyCurrentVersion -eq $AgyLatestVersion) {
                    Write-Host "Antigravity CLI $AgyCurrentVersion is already current — skipped."
                } else {
                    Write-Host "Antigravity CLI $AgyCurrentVersion is newer than the latest published $AgyLatestVersion — skipped."
                }
            } else {
                $AgyUpdateAvailable = $true
                Write-Host "Antigravity CLI $AgyCurrentVersion → $AgyLatestVersion — update available."
            }
        } else {
            $AgyNeedsUpdate = $false
            Write-Host "Antigravity CLI $AgyCurrentVersion is installed; latest release could not be checked — skipped."
        }
    } else {
        $AgyNeedsUpdate = $false
        $AgyUpdateAvailable = $false
        Write-Host 'Antigravity CLI is installed but its version could not be detected — skipped.'
    }
} else {
    $AgyUpdateAvailable = $true
    Write-Host 'Antigravity CLI not found — installation available.'
}

$ClaudeExe = Find-Claude
$ClaudeCurrentVersion = if ($ClaudeExe) { Get-VersionFromText ((& $ClaudeExe --version 2>$null) -join "`n") } else { '' }
$ClaudeNeedsUpdate = $true
$ClaudeUpdateAvailable = $true
if ($ClaudeExe) {
    if ($ClaudeCurrentVersion) { Write-Host "Claude Code $ClaudeCurrentVersion is installed — install/update available." }
    else { Write-Host 'Claude Code is installed — install/update available.' }
} else {
    Write-Host 'Claude Code not found — installation available.'
}

$DeepSeekHarnessExe = Find-DeepSeekHarness
$DeepSeekHarnessCurrentVersion = if ($DeepSeekHarnessExe) { Get-DeepSeekHarnessVersion $DeepSeekHarnessExe } else { '' }
$DeepSeekHarnessNeedsUpdate = $true
$DeepSeekHarnessUpdateAvailable = $false
$DeepSeekHarnessTargetVersion = $DeepSeekHarnessDesktopVersion
if ($DeepSeekHarnessExe) {
    if ($DeepSeekHarnessCurrentVersion -eq $DeepSeekHarnessTargetVersion) {
        $DeepSeekHarnessNeedsUpdate = $false
        Write-Host "DeepSeek Harness $DeepSeekHarnessCurrentVersion is already current — skipped."
    } else {
        $DeepSeekHarnessUpdateAvailable = $true
        $dshCurrentDisplay = if ($DeepSeekHarnessCurrentVersion) { $DeepSeekHarnessCurrentVersion } else { 'unknown' }
        Write-Host "DeepSeek Harness $dshCurrentDisplay → $DeepSeekHarnessTargetVersion — install/update available."
    }
} else {
    $DeepSeekHarnessUpdateAvailable = $true
    Write-Host 'DeepSeek Harness not found — installation available.'
}

$RtkExe = Find-Rtk
if ($RtkExe -and -not $env:LAZYDEV_BIN_DIR) { $RtkBinRoot = Split-Path -Parent $RtkExe }
$RtkCurrentVersion = ''
$RtkLatestVersion = ''
$RtkNeedsUpdate = $true
$RtkUpdateAvailable = $false
if ($RtkExe) {
    $RtkCurrentVersion = Get-RtkVersion $RtkExe
    if ($RtkCurrentVersion -and (Test-RtkTokenKiller $RtkExe)) {
        $RtkLatestVersion = Get-RtkLatestVersion
        if ($RtkLatestVersion) {
            if (Test-VersionAtLeast $RtkCurrentVersion $RtkLatestVersion) {
                $RtkNeedsUpdate = $false
                if ($RtkCurrentVersion -eq $RtkLatestVersion) {
                    Write-Host "RTK $RtkCurrentVersion is already current — skipped."
                } else {
                    Write-Host "RTK $RtkCurrentVersion is newer than the latest published $RtkLatestVersion — skipped."
                }
            } else {
                $RtkUpdateAvailable = $true
                Write-Host "RTK $RtkCurrentVersion → $RtkLatestVersion — update available."
            }
        } else {
            $RtkNeedsUpdate = $false
            Write-Host "RTK $RtkCurrentVersion is installed; latest release could not be checked — skipped."
        }
    } elseif ($RtkCurrentVersion) {
        $RtkCurrentVersion = ''
        $RtkUpdateAvailable = $true
        Write-Host 'A different RTK package is installed — the Rust Token Killer will be installed by LazyDev.'
    } else {
        $RtkNeedsUpdate = $false
        $RtkUpdateAvailable = $false
        Write-Host 'RTK is installed but its version could not be detected — skipped.'
    }
} else {
    $RtkUpdateAvailable = $true
    Write-Host 'RTK not found — installation available.'
}

$InstallKimi = $false
$InstallCodex = $false
$InstallAntigravity = $false
$InstallClaude = $false
$InstallDeepSeekHarness = $false
$InstallRtk = $false
if ($KimiUpdateAvailable) {
    $InstallKimi = Ask-InstallUi 'Install/update Kimi Code?'
    if (-not $InstallKimi) { $KimiNeedsUpdate = $false; Write-Host 'Kimi Code update/install declined — skipped.' }
}
if ($CodexUpdateAvailable) {
    $InstallCodex = Ask-InstallUi 'Install/update Codex?'
    if (-not $InstallCodex) { $CodexNeedsUpdate = $false; Write-Host 'Codex update/install declined — skipped.' }
}
if ($AgyUpdateAvailable) {
    $InstallAntigravity = Ask-InstallUi 'Install/update Antigravity?'
    if (-not $InstallAntigravity) { $AgyNeedsUpdate = $false; Write-Host 'Antigravity update/install declined — skipped.' }
}
if ($ClaudeUpdateAvailable) {
    $InstallClaude = Ask-InstallUi 'Install/update Claude Code?'
    if (-not $InstallClaude) { $ClaudeNeedsUpdate = $false; Write-Host 'Claude Code update/install declined — skipped.' }
}
if ($DeepSeekHarnessUpdateAvailable) {
    $InstallDeepSeekHarness = Ask-InstallUi 'Install/update DeepSeek Harness?'
    if (-not $InstallDeepSeekHarness) { $DeepSeekHarnessNeedsUpdate = $false; Write-Host 'DeepSeek Harness update/install declined — skipped.' }
}
# RTK is a required dependency for the Lazy Developer install lifecycle.
# Keep the decision automatic: install it when missing/outdated/wrong, otherwise skip.
if (-not $RtkNeedsUpdate) { $InstallRtk = $false } else { $InstallRtk = $true }

# Clear the question screen before the actual install/update work.
Clear-Host

$RemoteRevision = if ($LocalSourceDir) { Get-LazyDevLocalSourceRevision $LocalSourceDir } else { Get-GitHubRevision }
if (-not $RemoteRevision) { Fail 'Could not read the current Lazy Developer revision from GitHub.' }
$InstalledLazyVersion = Get-InstalledLazyVersion
$InstalledLazyRevision = Get-InstalledLazyRevision
$Launcher = Join-Path $BinRoot 'lazydev.cmd'
$LazyDevFeatureRefresh = $false
$installedPy = Join-Path $InstallRoot 'cli\lazydev.py'
if (-not (Test-SafePath $installedPy 'Leaf')) {
    $LazyDevFeatureRefresh = $true
} else {
    try {
        $pyText = Get-Content -Raw -LiteralPath $installedPy
        if ($pyText -notmatch 'lazydev resume' -or
            $pyText -notmatch "if\s+cmd\s*==\s*[`"']resume[`"']:" -or
            $pyText -notmatch 'return chat\(resume=True\)' -or
            $pyText -notmatch 'def _discover_command\(' -or
            $pyText -notmatch 'def _resolve_from_dirs\(' -or
            $pyText -notmatch 'def _managed_which\(' -or
            $pyText -notmatch 'def find_kimi\(' -or
            $pyText -notmatch 'def find_codex\(' -or
            $pyText -notmatch 'def find_antigravity\(' -or
            $pyText -notmatch 'def find_claude\(' -or
            $pyText -match "[`"']--config[`"']") { $LazyDevFeatureRefresh = $true }
    } catch { $LazyDevFeatureRefresh = $true }
}
if (-not (Test-SafePath (Join-Path $InstallRoot 'runtime\lazydev-ui.mjs') 'Leaf')) { $LazyDevFeatureRefresh = $true }
$installedMjs = Join-Path $InstallRoot 'scripts\lazydev.mjs'
if (-not (Test-SafePath $installedMjs 'Leaf')) {
    $LazyDevFeatureRefresh = $true
} else {
    try {
        $mjsText = Get-Content -Raw -LiteralPath $installedMjs
        if ($mjsText -notmatch "if \(cmd === 'resume'\) return resume\(\);" -or $mjsText -match "if \(cmd === 'sessions'\)") { $LazyDevFeatureRefresh = $true }
    } catch { $LazyDevFeatureRefresh = $true }
}
$LazyInstallComplete = (Test-SafePath (Join-Path $InstallRoot 'package.json') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'cli\lazydev.py') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'skills\lazy-developer\SKILL.md') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'skills\lazy-debug\SKILL.md') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'skills\lazy-review\SKILL.md') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'skills\lazy-test\SKILL.md') 'Leaf') -and
    (Test-SafePath (Join-Path $InstallRoot 'cli\lazydev.py') 'Leaf') -and
    (Test-SafePath $Launcher 'Leaf')
$LazyDevNeedsUpdate = $true
$LazyDevStatusMessage = ""
if ($LocalSourceDir) {
    if ($env:LAZYDEV_FORCE_REINSTALL -eq '1' -or $LazyDevFeatureRefresh -or -not $LazyInstallComplete -or -not $InstalledLazyRevision -or $InstalledLazyRevision -ne $RemoteRevision) {
        $LazyDevNeedsUpdate = $true
        $LazyDevStatusMessage = "Local Lazy Developer source differs or needs repair — refreshing Lazy Developer only."
    } else {
        $LazyDevNeedsUpdate = $false
        $LazyDevStatusMessage = "Lazy Developer $LazyDevVersion is already current — skipped."
    }
} elseif ($LazyDevFeatureRefresh) {
    $LazyDevNeedsUpdate = $true
    $LazyDevStatusMessage = 'Installed Lazy Developer is missing the current command surface — refreshing Lazy Developer only.'
} elseif ($InstalledLazyVersion -and $InstalledLazyVersion -ne $LazyDevVersion) {
    $LazyDevStatusMessage = "Lazy Developer version $InstalledLazyVersion differs from $LazyDevVersion — update required."
} elseif ($LazyInstallComplete -and $InstalledLazyRevision -and $InstalledLazyRevision -eq $RemoteRevision) {
    $LazyDevNeedsUpdate = $false
    $LazyDevStatusMessage = "Lazy Developer $LazyDevVersion is already current — skipped."
} else {
    $LazyDevStatusMessage = "Lazy Developer changed or is missing — update required."
}

if (Test-SafePath (Join-Path $InstallRoot 'runtime-node') 'Container') {
    $LazyDevNeedsUpdate = $true
    $LazyDevStatusMessage = if ($LazyDevStatusMessage) { $LazyDevStatusMessage + ' ' } else { '' }
    $LazyDevStatusMessage += 'Legacy private Node.js runtime detected — it will be removed during the Lazy Developer update.'
}

# Installation order: collect all Y/n choices first, then RTK → Lazy Developer → selected UI(s).
# Provider/model setup is intentionally skipped; use `lazydev setup` after installation.

# Always render RTK first. A reinstall shows an explicit skipped state; a fresh or invalid
# install repairs RTK before Lazy Developer starts.
Step 'RTK'
if ($RtkNeedsUpdate) {
    Write-Host 'RTK is missing, outdated, or not the Rust Token Killer — installing the official RTK first.'
    Install-Rtk
    $env:Path = "$BinRoot;$CodexBinRoot;$RtkBinRoot;$(Join-Path $HOME '.kimi-code\bin');$env:Path"
    $RtkExe = Find-Rtk
    if (-not $RtkExe) { Fail 'RTK did not install a usable launcher.' }
    if (-not (Test-RtkTokenKiller $RtkExe)) { Fail 'Installed RTK is not the Rust Token Killer.' }
    $RtkCurrentVersion = Get-RtkVersion $RtkExe
    if (-not $RtkCurrentVersion) { Fail 'Could not read the installed RTK version.' }
    $PersistedRtkCommand = $RtkExe
    Write-Host "✓ RTK $RtkCurrentVersion ready"
} else {
    $rtkDisplayVersion = if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'installed' }
    Write-Host "✓ RTK $rtkDisplayVersion already current — skipped."
}

# Lazy Developer runtime is refreshed before the selected AI UIs.
# Python is only needed for the LazyDev runtime. Defer this potentially slow
# bootstrap until after the quick component detection and user choices.
Ensure-PythonRunner

if ($LazyDevNeedsUpdate) {
    if ($LazyDevStatusMessage) { Write-Host $LazyDevStatusMessage }
    Step "Installing/updating Lazy Developer $LazyDevVersion"
    $tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-" + [guid]::NewGuid().ToString('N'))
    $archive = Join-Path $tempRoot 'lazydev.zip'
    $extract = Join-Path $tempRoot 'extract'
    $stage = Join-Path $tempRoot 'stage'
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    try {
        if ($LocalSourceDir) {
            $sourceDirPath = $LocalSourceDir
        } else {
            Write-Host "Downloading Lazy Developer source from $ArchiveUrl"
            Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $archive
            Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
            $sourceDir = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
            if (-not $sourceDir) { Fail 'Downloaded Lazy Developer source could not be unpacked.' }
            $sourceDirPath = $sourceDir.FullName
            $RemoteRevision = Get-GitHubRevision
            if (-not $RemoteRevision) { $RemoteRevision = 'unknown-remote' }
        }
        if (-not (Test-LazyDevSourceCurrent $sourceDirPath)) { Fail 'Lazy Developer source failed capability validation.' }
        $packageJson = Join-Path $sourceDirPath 'package.json'
        if (-not (Test-SafePath $packageJson 'Leaf')) { Fail 'Lazy Developer package.json was not found.' }
        $sourceVersion = ((Get-Content -Raw -LiteralPath $packageJson) | ConvertFrom-Json).version
        if ($sourceVersion -ne $LazyDevVersion) { Fail "Repository version is $sourceVersion; expected $LazyDevVersion." }
        Get-ChildItem -LiteralPath $sourceDirPath -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
        Remove-Item -LiteralPath (Join-Path $stage '.git') -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $stage 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -LiteralPath $stage -Directory -Recurse -Force -Filter '__pycache__' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -LiteralPath $stage -File -Recurse -Force -Filter '*.pyc' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        Set-Content -LiteralPath (Join-Path $stage '.lazydev-revision') -Value $RemoteRevision -Encoding ASCII
        if (Test-SafePath $InstallRoot) {
            foreach ($legacy in @((Join-Path $InstallRoot 'rtk.exe'), (Join-Path $InstallRoot 'codex.exe'), (Join-Path $InstallRoot 'codex.bin'), (Join-Path $InstallRoot 'bin\rtk.exe'), (Join-Path $InstallRoot 'bin\codex.exe'), (Join-Path $InstallRoot 'bin\codex.bin'))) {
                if (Test-SafePath $legacy 'Leaf') {
                    $name = if ($legacy -match '(?i)rtk') { 'rtk.exe' } else { 'codex.exe' }
                    $dest = Join-Path $ExternalBinRoot $name
                    if (-not (Test-SafePath $dest 'Leaf')) { Copy-Item -LiteralPath $legacy -Destination $dest -Force }
                    if (-not (Test-SafePath $dest 'Leaf')) { Fail "Refusing to replace LazyDev runtime: could not preserve external binary $legacy." }
                }
            }
            Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue
            Move-Item -LiteralPath $InstallRoot -Destination "$InstallRoot.previous" -Force
        }
        New-Item -ItemType Directory -Path (Split-Path $InstallRoot -Parent) -Force | Out-Null
        Move-Item -LiteralPath $stage -Destination $InstallRoot -Force

        New-Item -ItemType Directory -Path $BinRoot -Force | Out-Null
        $launcherContent = @(
            '@echo off',
            'setlocal',
            ('set "LAZYDEV_ROOT=' + $InstallRoot + '"'),
            ('set "PATH=' + $BinRoot + ';' + $KimiBinRoot + ';%PATH%"'),
            'where py.exe >nul 2>&1',
            'if not errorlevel 1 (',
            '  py.exe -3 "%LAZYDEV_ROOT%\cli\lazydev.py" %*',
            '  set "EXIT_CODE=%ERRORLEVEL%"',
            '  endlocal & exit /b %EXIT_CODE%',
            ')',
            'where python.exe >nul 2>&1',
            'if not errorlevel 1 (',
            '  python.exe "%LAZYDEV_ROOT%\cli\lazydev.py" %*',
            '  set "EXIT_CODE=%ERRORLEVEL%"',
            '  endlocal & exit /b %EXIT_CODE%',
            ')',
            'where uv.exe >nul 2>&1',
            'if not errorlevel 1 (',
            '  uv.exe run --no-project --python 3.13 "%LAZYDEV_ROOT%\cli\lazydev.py" %*',
            '  set "EXIT_CODE=%ERRORLEVEL%"',
            '  endlocal & exit /b %EXIT_CODE%',
            ')',
            'echo LazyDev requires Python 3.10+ or uv. The installer does not install Node.js. 1>&2',
            'endlocal & exit /b 1'
        ) -join [Environment]::NewLine
        Set-Content -LiteralPath $Launcher -Value $launcherContent -Encoding ASCII
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $parts = if ($userPath) { @($userPath -split ';' | Where-Object { $_ }) } else { @() }
        foreach ($entry in @($BinRoot, (Join-Path $HOME '.kimi-code\bin'))) {
            if ($parts -notcontains $entry) { $parts += $entry }
        }
        [Environment]::SetEnvironmentVariable('Path', (($parts | Select-Object -Unique) -join ';'), 'User')
        $env:Path = "$BinRoot;$(Join-Path $HOME '.kimi-code\bin');$env:Path"
        Write-Host "✓ Lazy Developer $LazyDevVersion ready"
    } finally { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
} else {
    if ($LazyDevStatusMessage) { Write-Host $LazyDevStatusMessage }
}

Refresh-ExistingLazyDevLaunchers
Ensure-CompatibilityLazyDevLauncher
Refresh-ActiveLazyDevLauncher
$LazyDevHelp = & $Launcher help 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { Write-Host $LazyDevHelp; Fail 'Lazy Developer launcher did not execute after refresh.' }
if (($LazyDevHelp -notmatch 'lazydev resume') -or ($LazyDevHelp -match 'lazydev sessions')) { Write-Host $LazyDevHelp; Fail 'Lazy Developer command surface is stale: expected lazydev resume and no lazydev sessions.' }
Write-Host 'Lazy Developer setup — skipped. Configure providers later with: lazydev setup'

Install-CliUiRuntime

if ($RtkExe) { Connect-RtkToKimi $RtkExe }

if ($InstallKimi -and $KimiNeedsUpdate) {
    Step "Installing/updating Kimi Code to the latest available release"
    $kimiInstallerPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-kimi-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
    $kimiInstallerLog = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-kimi-install-" + [guid]::NewGuid().ToString('N') + '.log')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $KimiInstallUrl -OutFile $kimiInstallerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $kimiInstallerPath *> $kimiInstallerLog
        $kimiExitCode = $LASTEXITCODE
        if (Test-SafePath $kimiInstallerLog) { Get-Content -LiteralPath $kimiInstallerLog | Write-Host }
        if ($kimiExitCode -ne 0) {
            $npmError = $false
            if (Test-SafePath $kimiInstallerLog) {
                $npmError = Select-String -Path $kimiInstallerLog -Pattern 'npm\s+(ERR!|error)|ERR_NPM|ERESOLVE|EAI_AGAIN|ELIFECYCLE|ENOENT.*npm|command failed.*npm' -Quiet -CaseSensitive:$false
            }
            if ($npmError) { Fail "Kimi Code installer failed with an npm error. The npm failure is shown above; fix npm/node setup and rerun LazyDev installer." }
            Fail "Kimi Code installer exited with code $kimiExitCode."
        }
    } finally {
        Remove-Item -LiteralPath $kimiInstallerPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $kimiInstallerLog -Force -ErrorAction SilentlyContinue
    }
    $KimiExe = Find-Kimi
    if (-not $KimiExe) { Fail "Kimi Code did not install a usable launcher." }
    $KimiCurrentVersion = Get-KimiVersion $KimiExe
    if (-not $KimiCurrentVersion) { Fail 'Installed Kimi Code version could not be detected.' }
    $PersistedKimiCommand = $KimiExe
    if ($KimiLatestVersion -and -not (Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion)) { Fail "Installed Kimi Code is $KimiCurrentVersion; latest detected release is $KimiLatestVersion." }
    Write-Host "✓ Kimi Code $KimiCurrentVersion ready"
}

if ($InstallCodex -and $CodexNeedsUpdate) {
    Step 'Installing/updating official Codex CLI'
    $CodexTargetVersion = if ($CodexLatestVersion) { $CodexLatestVersion } else { Get-CodexLatestVersion }
    if (-not $CodexTargetVersion) { Fail 'Could not resolve the latest official Codex release version.' }
    Install-CodexOfficial $CodexTargetVersion
    $env:Path = "$BinRoot;$(Join-Path $HOME '.local\bin');$env:Path"
    $CodexInstalledPath = Join-Path $CodexBinRoot 'codex.exe'
    $CodexExe = if (Test-SafePath $CodexInstalledPath 'Leaf') { $CodexInstalledPath } else { Find-Codex }
    if (-not $CodexExe) { Fail 'Codex did not install a usable launcher.' }
    $CodexCurrentVersion = Get-VersionFromText ((& $CodexExe --version 2>$null) -join "`n")
    $PersistedCodexCommand = $CodexExe
    if (-not $CodexCurrentVersion) {
        $CodexCurrentVersion = $CodexTargetVersion
        Write-Host "✓ Codex $CodexCurrentVersion ready (official archive verified)"
    } else {
        if ($CodexTargetVersion -and -not (Test-VersionAtLeast $CodexCurrentVersion $CodexTargetVersion)) { Fail "Installed Codex is $CodexCurrentVersion; verified package is $CodexTargetVersion." }
        Write-Host "✓ Codex $CodexCurrentVersion ready"
    }
}

if ($InstallAntigravity -and $AgyNeedsUpdate) {
    Step 'Installing/updating official Antigravity CLI'
    $agyInstallerPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-antigravity-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
    $agyInstallerLog = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-antigravity-install-" + [guid]::NewGuid().ToString('N') + '.log')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $AntigravityInstallUrl -OutFile $agyInstallerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agyInstallerPath *> $agyInstallerLog
        $agyExitCode = $LASTEXITCODE
        if (Test-SafePath $agyInstallerLog) { Get-Content -LiteralPath $agyInstallerLog | Write-Host }
        if ($agyExitCode -ne 0) { Fail "Antigravity installer exited with code $agyExitCode." }
    } finally {
        Remove-Item -LiteralPath $agyInstallerPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $agyInstallerLog -Force -ErrorAction SilentlyContinue
    }
    $env:Path = "$BinRoot;$(Join-Path $HOME '.local\bin');$env:Path"
    $AgyExe = Find-Antigravity
    if (-not $AgyExe) { Fail 'Antigravity did not install a usable launcher.' }
    $AgyCurrentVersion = Get-VersionFromText ((& $AgyExe --version 2>$null) -join "`n")
    $PersistedAntigravityCommand = $AgyExe
    if (-not $AgyCurrentVersion) { Fail 'Installed Antigravity version could not be detected.' }
    if ($AgyLatestVersion -and -not (Test-VersionAtLeast $AgyCurrentVersion $AgyLatestVersion)) { Fail "Installed Antigravity is $AgyCurrentVersion; latest detected release is $AgyLatestVersion." }
    Write-Host "✓ Antigravity CLI $AgyCurrentVersion ready"
}

if ($InstallClaude -and $ClaudeNeedsUpdate) {
    Step 'Installing/updating official Claude Code'
    $claudeInstallerPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-claude-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
    $claudeInstallerLog = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-claude-install-" + [guid]::NewGuid().ToString('N') + '.log')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $ClaudeInstallUrl -OutFile $claudeInstallerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $claudeInstallerPath *> $claudeInstallerLog
        $claudeExitCode = $LASTEXITCODE
        if (Test-SafePath $claudeInstallerLog) { Get-Content -LiteralPath $claudeInstallerLog | Write-Host }
        if ($claudeExitCode -ne 0) { Fail "Claude Code installer exited with code $claudeExitCode." }
    } finally {
        Remove-Item -LiteralPath $claudeInstallerPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $claudeInstallerLog -Force -ErrorAction SilentlyContinue
    }
    $env:Path = "$BinRoot;$env:Path"
    $ClaudeExe = Find-Claude
    if (-not $ClaudeExe) { Fail 'Claude Code did not install a usable launcher.' }
    $ClaudeCurrentVersion = Get-VersionFromText ((& $ClaudeExe --version 2>$null) -join "`n")
    $PersistedClaudeCommand = $ClaudeExe
    Write-Host "✓ Claude Code $($(if ($ClaudeCurrentVersion) { $ClaudeCurrentVersion } else { 'installed' })) ready"
}

if ($InstallDeepSeekHarness -and $DeepSeekHarnessNeedsUpdate) {
    Step "Installing/updating DeepSeek Harness $DeepSeekHarnessTargetVersion"
    $node = Find-NodeCommand
    $npm = Find-NpmCommand
    if (-not $node -or -not $npm) { Fail 'DeepSeek Harness needs Node.js and a package manager.' }
    New-Item -ItemType Directory -Path $DeepSeekHarnessRuntime -Force | Out-Null
    $pkgPath = Join-Path $DeepSeekHarnessRuntime 'package.json'
    $dshPackage = [ordered]@{
        name = '@blizps/lazydev-deepseek-harness-runtime'
        private = $true
        dependencies = [ordered]@{ $DeepSeekHarnessPackage = $DeepSeekHarnessTargetVersion }
    }
    $dshPackage | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $pkgPath -Encoding UTF8
    Push-Location $DeepSeekHarnessRuntime
    try {
        & $npm install --no-package-lock --include=optional --omit=dev
        if ($LASTEXITCODE -ne 0) { Fail 'DeepSeek Harness installation failed.' }
    } finally { Pop-Location }
    $DeepSeekHarnessExe = Find-DeepSeekHarness
    if (-not $DeepSeekHarnessExe) { Fail 'DeepSeek Harness did not install a usable launcher.' }
    $DeepSeekHarnessCurrentVersion = Get-DeepSeekHarnessVersion $DeepSeekHarnessExe
    if ($DeepSeekHarnessCurrentVersion -ne $DeepSeekHarnessTargetVersion) { Fail "DeepSeek Harness reports $DeepSeekHarnessCurrentVersion; expected $DeepSeekHarnessTargetVersion." }
    & $DeepSeekHarnessExe web --help *> $null
    if ($LASTEXITCODE -ne 0) { Fail 'DeepSeek Harness Web UI runtime is incomplete.' }
    $PersistedDeepSeekHarnessCommand = $DeepSeekHarnessExe
    Write-Host "✓ DeepSeek Harness $DeepSeekHarnessCurrentVersion ready"
}

# Prefer the managed bin directory in new and current PowerShell sessions.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = if ($userPath) { @($userPath -split ';' | Where-Object { $_ }) } else { @() }
$entries = @($entries | Where-Object { $_ -notin @($BinRoot, (Join-Path $HOME '.kimi-code\bin')) })
$entries = @($BinRoot, $CodexBinRoot, $RtkBinRoot, (Join-Path $HOME '.kimi-code\bin')) + $entries
[Environment]::SetEnvironmentVariable('Path', ($entries | Select-Object -Unique) -join ';', 'User')
$env:Path = (($entries | Select-Object -Unique) -join ';')

# Re-resolve installed components and persist their exact executable paths so
# LazyDev does not depend on the current PowerShell session's PATH.
$resolvedRtk = Find-Rtk
if ($resolvedRtk) { $PersistedRtkCommand = $resolvedRtk }
$resolvedKimi = Find-Kimi
if ($resolvedKimi) { $PersistedKimiCommand = $resolvedKimi }
$resolvedCodex = Find-Codex
if ($resolvedCodex) { $PersistedCodexCommand = $resolvedCodex }
$resolvedAgy = Find-Antigravity
if ($resolvedAgy) { $PersistedAntigravityCommand = $resolvedAgy }
$resolvedClaude = Find-Claude
if ($resolvedClaude) { $PersistedClaudeCommand = $resolvedClaude }
$resolvedDeepSeekHarness = Find-DeepSeekHarness
if ($resolvedDeepSeekHarness) { $PersistedDeepSeekHarnessCommand = $resolvedDeepSeekHarness }

# Actual installation order: RTK → Lazy Developer → selected UI(s) (Kimi → Codex → Antigravity → Claude Code → DeepSeek Harness).

function Refresh-ActiveLazyDevLauncher {
    $canonical = Join-Path $BinRoot 'lazydev.cmd'
    if (-not (Test-SafePath $canonical 'Leaf')) { return }
    $active = Get-Command lazydev -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $active -or -not $active.Source) { return }
    $path = $active.Source
    if ($path -eq $canonical -or -not (Test-SafePath $path 'Leaf')) { return }
    try {
        $text = Get-Content -Raw -LiteralPath $path -ErrorAction Stop
        if ($text -match 'Lazy Developer|lazydev\.mjs|lazydev\.py|@blizps/lazy-developer|free-kimi-code') {
            Copy-Item -LiteralPath $canonical -Destination $path -Force
            Write-Host "✓ Refreshed active LazyDev launcher: $path"
        }
    } catch {}
}

function Ensure-CompatibilityLazyDevLauncher {
    $canonical = Join-Path $BinRoot 'lazydev.cmd'
    if (-not (Test-SafePath $canonical 'Leaf')) { return }
    $dirs = @($BinRoot, (Join-Path $HOME '.local\bin')) | Select-Object -Unique
    foreach ($dir in $dirs) {
        try {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            $target = Join-Path $dir 'lazydev.cmd'
            if ($target -ne $canonical) { Copy-Item -LiteralPath $canonical -Destination $target -Force }
        } catch {}
    }
}

function Refresh-ExistingLazyDevLaunchers {
    $canonical = Join-Path $BinRoot 'lazydev.cmd'
    if (-not (Test-SafePath $canonical 'Leaf')) { return }
    $seen = @{}
    $commands = @(Get-Command lazydev -All -ErrorAction SilentlyContinue)
    foreach ($cmd in $commands) {
        $path = $cmd.Source
        if (-not $path) { continue }
        if ($seen[$path]) { continue }
        $seen[$path] = $true
        if ($path -eq $canonical) { continue }
        try {
            $text = Get-Content -Raw -LiteralPath $path -ErrorAction Stop
            if ($text -match 'Lazy Developer managed launcher|lazydev\.mjs|@blizps/lazy-developer|free-kimi-code') {
                Copy-Item -LiteralPath $canonical -Destination $path -Force
                Write-Host "✓ Refreshed existing LazyDev launcher: $path"
            }
        } catch {}
    }
}

Write-InstallState

Write-Host ''
Write-Host 'Lazy Developer installer finished.'
if ($KimiCurrentVersion) {
    $KimiDisplayFinal = $KimiCurrentVersion
} else {
    $KimiDisplayFinal = 'unknown'
}
Write-Host "Kimi Code: $KimiDisplayFinal"
Write-Host "Claude Code: $($(if ($ClaudeCurrentVersion) { $ClaudeCurrentVersion } else { 'unknown' }))"
Write-Host "DeepSeek Harness: $($(if ($DeepSeekHarnessCurrentVersion) { $DeepSeekHarnessCurrentVersion } else { 'unknown' }))"
Write-Host "RTK: $($(if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'unknown' }))"
Write-Host "Lazy Developer: $LazyDevVersion"
Write-Host 'Existing Kimi sessions and native client data were left in place.'
Write-Host ''
Write-Host 'Provider setup is intentionally separate and was not run by the installer.'
Write-Host 'Next:'
Write-Host '  lazydev setup'
Write-Host '  lazydev chat'
Write-Host '  lazydev resume'
