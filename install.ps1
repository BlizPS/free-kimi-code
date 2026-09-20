[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'BlizPS/free-kimi-code'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }

# Prefer bundled source when this script is executed from an extracted archive.
$LocalSourceDir = if ($env:LAZYDEV_SOURCE_DIR) { $env:LAZYDEV_SOURCE_DIR } elseif ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json')) -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'cli\lazydev.py'))) { $PSScriptRoot } else { '' }
$LazyDevVersion = '1.0.2'
$KimiInstallUrl = 'https://code.kimi.com/kimi-code/install.ps1'
$AntigravityInstallUrl = 'https://antigravity.google/cli/install.ps1'
$KimiReleasesApiUrl = 'https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest'
$CodexReleasesApiUrl = 'https://api.github.com/repos/openai/codex/releases/latest'
$AntigravityReleasesApiUrl = 'https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest'
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$GitHubApiUrl = "https://api.github.com/repos/$Repo/commits/$Branch"
$RtkApiUrl = 'https://api.github.com/repos/rtk-ai/rtk/releases/latest'
$RtkInstallRepo = 'https://github.com/rtk-ai/rtk'
$InstallRoot = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$BinRoot = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }
$ConfigRoot = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $env:APPDATA 'lazydev' }
$KimiRuntimeHome = Join-Path $ConfigRoot 'kimi-code'
$RtkConfigCandidates = @(
    (Join-Path $env:APPDATA 'rtk'),
    (Join-Path $env:LOCALAPPDATA 'rtk')
)

function Step([string]$Message) { Write-Host "`n==> $Message" }
function Fail([string]$Message) { throw $Message }
function Get-VersionFromText([string]$Text) {
    $m = [regex]::Match($Text, '(\d+\.\d+\.\d+)')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}
function Test-VersionAtLeast([string]$Current, [string]$Required) {
    try { return ([version]$Current -ge [version]$Required) } catch { return $false }
}
function Find-Kimi {
    foreach ($candidate in @(
        (Join-Path $HOME '.kimi-code\bin\kimi.exe'),
        (Join-Path $HOME '.local\bin\kimi.exe'),
        (Join-Path $HOME '.local\bin\kimi.cmd')
    )) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    foreach ($name in @('kimi.exe','kimi.cmd','kimi')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}
function Get-KimiVersion([string]$Exe) {
    if (-not $Exe) { return '' }
    try { return Get-VersionFromText ((& $Exe --version 2>$null) -join "`n") } catch { return '' }
}
function Find-Codex {
    $cmd = Get-Command codex.exe,codex.cmd,codex -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @((Join-Path $HOME '.local\bin\codex.exe'), (Join-Path $HOME '.local\bin\codex.cmd'))) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return $null
}
function Find-Antigravity {
    # Prefer the exact `agy` command currently resolved by PowerShell so a
    # stale local binary cannot trigger a false update prompt.
    $cmd = Get-Command agy.exe,agy.cmd,agy -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @((Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'), (Join-Path $HOME '.local\bin\agy.exe'))) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return $null
}
function Ask-InstallUi([string]$Label) {
    $answer = Read-Host "$Label [Y/n]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $true }
    return $answer -match '^(?i)y|yes$'
}

function Find-Rtk {
    foreach ($name in @('rtk.exe','rtk')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $candidate = Join-Path $BinRoot 'rtk.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    return $null
}
function Get-RtkVersion([string]$Exe) {
    if (-not $Exe) { return '' }
    try { return Get-VersionFromText ((& $Exe --version 2>$null) -join "`n") } catch { return '' }
}
function Get-PythonCommand {
    foreach ($name in @('py.exe', 'python.exe', 'python3.exe')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Ensure-PythonRunner {
    if (Get-PythonCommand) { return }
    $uv = Get-Command 'uv.exe' -ErrorAction SilentlyContinue
    if (-not $uv) {
        Step 'Installing standalone uv for the native Python LazyDev CLI'
        $tempUv = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-uv-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
        try {
            Invoke-WebRequest -UseBasicParsing -Uri 'https://astral.sh/uv/install.ps1' -OutFile $tempUv
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tempUv
            if ($LASTEXITCODE -ne 0) { Fail "uv installer exited with code $LASTEXITCODE." }
        } finally {
            Remove-Item -LiteralPath $tempUv -Force -ErrorAction SilentlyContinue
        }
        $uv = Get-Command 'uv.exe' -ErrorAction SilentlyContinue
    }
    if (-not $uv) { Fail 'Python was not found and standalone uv could not be installed.' }
    Write-Host '✓ uv is available as the Python bootstrapper.'
}
function Get-GitHubRevision {
    $headers = @{ Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28'; 'User-Agent'='lazy-developer-installer/1.0.2' }
    try {
        $data = Invoke-RestMethod -Headers $headers -Uri $GitHubApiUrl
        if ($data.sha -match '^[0-9a-fA-F]{40}$') { return $data.sha }
    } catch {}
    return $null
}
function Get-RtkLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.2' }
        $data = Invoke-RestMethod -Headers $headers -Uri $RtkApiUrl
        if ($data.tag_name -match '^v(\d+\.\d+\.\d+)$') { return $Matches[1] }
    } catch {}
    return ''
}
function Get-KimiLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.2' }
        $data = Invoke-RestMethod -Headers $headers -Uri $KimiReleasesApiUrl
        $tag = [string]$data.tag_name
        $m = [regex]::Match($tag, '(\d+\.\d+\.\d+)$')
        if ($m.Success) { return $m.Groups[1].Value }
    } catch {}
    return ''
}
function Get-GitHubReleaseVersion([string]$ApiUrl) {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28'; 'User-Agent'='lazy-developer-installer/1.0.2' }
        $data = Invoke-RestMethod -Headers $headers -Uri $ApiUrl
        $tag = [string]$data.tag_name
        $m = [regex]::Match($tag, '(\d+\.\d+\.\d+)$')
        if ($m.Success) { return $m.Groups[1].Value }
    } catch {}
    return ''
}
function Get-CodexLatestVersion { return Get-GitHubReleaseVersion $CodexReleasesApiUrl }

function Get-CodexReleaseTarget {
    if ($IsWindows) {
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
    if (Test-Path -LiteralPath $Path) {
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
        New-Item -ItemType Directory -Force -Path $BinRoot | Out-Null
        Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $BinRoot 'codex.exe') -Force
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
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return '' }
    try { return ((Get-Content -Raw -LiteralPath $file) | ConvertFrom-Json).version } catch { return '' }
}
function Get-InstalledLazyRevision {
    $file = Join-Path $InstallRoot '.lazydev-revision'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return '' }
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
        $release = Invoke-RestMethod -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.2' } -Uri $RtkApiUrl
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
        New-Item -ItemType Directory -Path $BinRoot -Force | Out-Null
        Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $BinRoot 'rtk.exe') -Force
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
@"
Lazy Developer installer

Installs or updates the latest Kimi Code release, RTK, and Lazy Developer $LazyDevVersion without npm or a private Node.js runtime.
The LazyDev CLI is native Python and does not require Node.js.
Run the same command again to update only components that changed.
Existing Kimi sessions are left alone during updates.
"@ | Write-Host
exit 0
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

$RtkExe = Find-Rtk
$RtkCurrentVersion = Get-RtkVersion $RtkExe
$RtkLatestVersion = ''
$RtkNeedsUpdate = $true
$RtkUpdateAvailable = $false
if ($RtkExe) {
    if ($RtkCurrentVersion) {
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
if ($RtkUpdateAvailable) {
    $InstallRtk = Ask-InstallUi 'Install/update RTK?'
    if (-not $InstallRtk) { $RtkNeedsUpdate = $false; Write-Host 'RTK update/install declined — skipped.' }
}

# Clear the question screen before the actual install/update work.
Clear-Host

# Python is only needed for the LazyDev runtime. Defer this potentially slow
# bootstrap until after the quick component detection and user choices.
Ensure-PythonRunner

$RemoteRevision = if ($LocalSourceDir) { 'local' } else { Get-GitHubRevision }
if (-not $RemoteRevision) { Fail 'Could not read the current Lazy Developer revision from GitHub.' }
$InstalledLazyVersion = Get-InstalledLazyVersion
$InstalledLazyRevision = Get-InstalledLazyRevision
$Launcher = Join-Path $BinRoot 'lazydev.cmd'
$LazyDevFeatureRefresh = $false
$installedPy = Join-Path $InstallRoot 'cli\lazydev.py'
if (-not (Test-Path -LiteralPath $installedPy -PathType Leaf)) {
    $LazyDevFeatureRefresh = $true
} else {
    try {
        $pyText = Get-Content -Raw -LiteralPath $installedPy
        if ($pyText -notmatch 'if cmd == "resume":\s*return chat\(resume=True\)' -or $pyText -match ('lazydev ' + 'sessions')) { $LazyDevFeatureRefresh = $true }
    } catch { $LazyDevFeatureRefresh = $true }
}
$installedMjs = Join-Path $InstallRoot 'scripts\lazydev.mjs'
if (-not (Test-Path -LiteralPath $installedMjs -PathType Leaf)) {
    $LazyDevFeatureRefresh = $true
} else {
    try {
        $mjsText = Get-Content -Raw -LiteralPath $installedMjs
        if ($mjsText -notmatch "if \(cmd === 'resume'\) return resume\(\);" -or $mjsText -match "if \(cmd === 'sessions'\)") { $LazyDevFeatureRefresh = $true }
    } catch { $LazyDevFeatureRefresh = $true }
}
$LazyInstallComplete = (Test-Path -LiteralPath (Join-Path $InstallRoot 'package.json') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'cli\lazydev.py') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-developer\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-debug\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-review\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-test\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'cli\lazydev.py') -PathType Leaf) -and
    (Test-Path -LiteralPath $Launcher -PathType Leaf)
$LazyDevNeedsUpdate = $true
if ($LocalSourceDir) {
    $LazyDevNeedsUpdate = $true
    Write-Host "Using local Lazy Developer source: $LocalSourceDir"
} elseif ($LazyDevFeatureRefresh) {
    $LazyDevNeedsUpdate = $true
    Write-Host 'Installed Lazy Developer is missing the current command surface — refreshing Lazy Developer only.'
} elseif ($InstalledLazyVersion -and $InstalledLazyVersion -ne $LazyDevVersion) {
    Write-Host "Lazy Developer version $InstalledLazyVersion differs from $LazyDevVersion — update required."
} elseif ($LazyInstallComplete -and $InstalledLazyRevision -and $InstalledLazyRevision -eq $RemoteRevision) {
    $LazyDevNeedsUpdate = $false
    Write-Host "Lazy Developer $LazyDevVersion is already current — skipped."
} else {
    Write-Host "Lazy Developer changed or is missing — update required."
}

if (Test-Path -LiteralPath (Join-Path $InstallRoot 'runtime-node') -PathType Container) {
    $LazyDevNeedsUpdate = $true
    Write-Host 'Legacy private Node.js runtime detected — it will be removed during the Lazy Developer update.'
}

if ($InstallCodex -and $CodexNeedsUpdate) {
    Step 'Installing/updating official Codex CLI'
    $CodexTargetVersion = if ($CodexLatestVersion) { $CodexLatestVersion } else { Get-CodexLatestVersion }
    if (-not $CodexTargetVersion) { Fail 'Could not resolve the latest official Codex release version.' }
    Install-CodexOfficial $CodexTargetVersion
    $env:Path = "$BinRoot;$(Join-Path $HOME '.local\bin');$env:Path"
    $CodexExe = Find-Codex
    if (-not $CodexExe) { Fail 'Codex did not install a usable launcher.' }
    $CodexCurrentVersion = Get-VersionFromText ((& $CodexExe --version 2>$null) -join "`n")
    if (-not $CodexCurrentVersion) { Fail 'Installed Codex version could not be detected.' }
    if ($CodexLatestVersion -and -not (Test-VersionAtLeast $CodexCurrentVersion $CodexLatestVersion)) { Fail "Installed Codex is $CodexCurrentVersion; latest detected release is $CodexLatestVersion." }
    Write-Host "✓ Codex $CodexCurrentVersion ready"
}
if ($InstallAntigravity -and $AgyNeedsUpdate) {
    Step 'Installing/updating official Antigravity CLI'
    $agyInstallerPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-antigravity-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
    $agyInstallerLog = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-antigravity-install-" + [guid]::NewGuid().ToString('N') + '.log')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $AntigravityInstallUrl -OutFile $agyInstallerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agyInstallerPath *> $agyInstallerLog
        $agyExitCode = $LASTEXITCODE
        if (Test-Path -LiteralPath $agyInstallerLog) { Get-Content -LiteralPath $agyInstallerLog | Write-Host }
        if ($agyExitCode -ne 0) { Fail "Antigravity installer exited with code $agyExitCode." }
    } finally {
        Remove-Item -LiteralPath $agyInstallerPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $agyInstallerLog -Force -ErrorAction SilentlyContinue
    }
    $env:Path = "$BinRoot;$(Join-Path $HOME '.local\bin');$env:Path"
    $AgyExe = Find-Antigravity
    if (-not $AgyExe) { Fail 'Antigravity did not install a usable launcher.' }
    $AgyCurrentVersion = Get-VersionFromText ((& $AgyExe --version 2>$null) -join "`n")
    if (-not $AgyCurrentVersion) { Fail 'Installed Antigravity version could not be detected.' }
    if ($AgyLatestVersion -and -not (Test-VersionAtLeast $AgyCurrentVersion $AgyLatestVersion)) { Fail "Installed Antigravity is $AgyCurrentVersion; latest detected release is $AgyLatestVersion." }
    Write-Host "✓ Antigravity CLI $AgyCurrentVersion ready"
}

if ($InstallKimi -and $KimiNeedsUpdate) {
    Step "Installing/updating Kimi Code to the latest available release"
    $kimiInstallerPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-kimi-install-" + [guid]::NewGuid().ToString('N') + '.ps1')
    $kimiInstallerLog = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-kimi-install-" + [guid]::NewGuid().ToString('N') + '.log')
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $KimiInstallUrl -OutFile $kimiInstallerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $kimiInstallerPath *> $kimiInstallerLog
        $kimiExitCode = $LASTEXITCODE
        if (Test-Path -LiteralPath $kimiInstallerLog) { Get-Content -LiteralPath $kimiInstallerLog | Write-Host }
        if ($kimiExitCode -ne 0) {
            $npmError = $false
            if (Test-Path -LiteralPath $kimiInstallerLog) {
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
    if ($KimiLatestVersion -and -not (Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion)) { Fail "Installed Kimi Code is $KimiCurrentVersion; latest detected release is $KimiLatestVersion." }
    Write-Host "✓ Kimi Code $KimiCurrentVersion ready"
}

if ($InstallRtk -and $RtkNeedsUpdate) {
    Step 'Installing/updating RTK'
    Install-Rtk
    $env:Path = "$BinRoot;$(Join-Path $HOME '.kimi-code\bin');$env:Path"
    $RtkExe = Find-Rtk
    if (-not $RtkExe) { Fail 'RTK did not install a usable launcher.' }
    $RtkCurrentVersion = Get-RtkVersion $RtkExe
    Write-Host "✓ RTK $RtkCurrentVersion ready"
}

if ($RtkExe) { Connect-RtkToKimi $RtkExe }

function Ensure-CompatibilityLazyDevLauncher {
    $canonical = Join-Path $BinRoot 'lazydev.cmd'
    if (-not (Test-Path -LiteralPath $canonical -PathType Leaf)) { return }
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
    if (-not (Test-Path -LiteralPath $canonical -PathType Leaf)) { return }
    $commands = @(Get-Command lazydev -All -ErrorAction SilentlyContinue)
    foreach ($cmd in $commands) {
        $path = $cmd.Source
        if (-not $path) { continue }
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

if ($LazyDevNeedsUpdate) {
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
            Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $archive
            Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
            $sourceDir = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
            if (-not $sourceDir) { Fail 'Downloaded Lazy Developer source could not be unpacked.' }
            $sourceDirPath = $sourceDir.FullName
        }
        $packageJson = Join-Path $sourceDirPath 'package.json'
        if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) { Fail 'Lazy Developer package.json was not found.' }
        $sourceVersion = ((Get-Content -Raw -LiteralPath $packageJson) | ConvertFrom-Json).version
        if ($sourceVersion -ne $LazyDevVersion) { Fail "Repository version is $sourceVersion; expected $LazyDevVersion." }
        Get-ChildItem -LiteralPath $sourceDirPath -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
        Remove-Item -LiteralPath (Join-Path $stage '.git') -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $stage 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -LiteralPath $stage -Directory -Recurse -Force -Filter '__pycache__' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -LiteralPath $stage -File -Recurse -Force -Filter '*.pyc' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        Set-Content -LiteralPath (Join-Path $stage '.lazydev-revision') -Value $RemoteRevision -Encoding ASCII
        if (Test-Path -LiteralPath $InstallRoot) {
            Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue
            Move-Item -LiteralPath $InstallRoot -Destination "$InstallRoot.previous" -Force
        }
        New-Item -ItemType Directory -Path (Split-Path $InstallRoot -Parent) -Force | Out-Null
        Move-Item -LiteralPath $stage -Destination $InstallRoot -Force
        Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue

        New-Item -ItemType Directory -Path $BinRoot -Force | Out-Null
        $launcherContent = @"
@echo off
setlocal
set "LAZYDEV_ROOT=$InstallRoot"
set "PATH=$BinRoot;$(Join-Path $HOME '.kimi-code\bin');%PATH%"
where py.exe >nul 2>&1
if not errorlevel 1 (
  py.exe -3 "%LAZYDEV_ROOT%\cli\lazydev.py" %*
  set "EXIT_CODE=%ERRORLEVEL%"
  endlocal & exit /b %EXIT_CODE%
)
where python.exe >nul 2>&1
if not errorlevel 1 (
  python.exe "%LAZYDEV_ROOT%\cli\lazydev.py" %*
  set "EXIT_CODE=%ERRORLEVEL%"
  endlocal & exit /b %EXIT_CODE%
)
where uv.exe >nul 2>&1
if not errorlevel 1 (
  uv.exe run --no-project --python 3.13 "%LAZYDEV_ROOT%\cli\lazydev.py" %*
  set "EXIT_CODE=%ERRORLEVEL%"
  endlocal & exit /b %EXIT_CODE%
)
echo LazyDev requires Python 3.10+ or uv. The installer does not install Node.js. 1>&2
endlocal & exit /b 1
"@
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
}

Refresh-ExistingLazyDevLaunchers
Ensure-CompatibilityLazyDevLauncher
# Prefer the managed bin directory in new and current PowerShell sessions.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = if ($userPath) { @($userPath -split ';' | Where-Object { $_ }) } else { @() }
$entries = @($entries | Where-Object { $_ -notin @($BinRoot, (Join-Path $HOME '.kimi-code\bin')) })
$entries = @($BinRoot, (Join-Path $HOME '.kimi-code\bin')) + $entries
[Environment]::SetEnvironmentVariable('Path', ($entries | Select-Object -Unique) -join ';', 'User')
$env:Path = (($entries | Select-Object -Unique) -join ';')

Write-Host ''
Write-Host 'Lazy Developer installer finished.'
if ($KimiCurrentVersion) {
    $KimiDisplayFinal = $KimiCurrentVersion
} else {
    $KimiDisplayFinal = 'unknown'
}
Write-Host "Kimi Code: $KimiDisplayFinal"
Write-Host "RTK: $($(if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'unknown' }))"
Write-Host "Lazy Developer: $LazyDevVersion"
Write-Host 'Existing Kimi sessions and configuration were left in place.'
Write-Host ''
Write-Host 'Next:'
Write-Host '  lazydev setup'
Write-Host '  lazydev chat'
