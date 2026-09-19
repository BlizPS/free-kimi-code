[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'BlizPS/lazy-developer-free-kimi-code'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }
$LazyDevVersion = '1.0.0'
$KimiInstallUrl = 'https://code.kimi.com/kimi-code/install.ps1'
$KimiReleasesApiUrl = 'https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest'
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
    $headers = @{ Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28'; 'User-Agent'='lazy-developer-installer/1.0.0' }
    try {
        $data = Invoke-RestMethod -Headers $headers -Uri $GitHubApiUrl
        if ($data.sha -match '^[0-9a-fA-F]{40}$') { return $data.sha }
    } catch {}
    return $null
}
function Get-RtkLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.0' }
        $data = Invoke-RestMethod -Headers $headers -Uri $RtkApiUrl
        if ($data.tag_name -match '^v(\d+\.\d+\.\d+)$') { return $Matches[1] }
    } catch {}
    return ''
}
function Get-KimiLatestVersion {
    try {
        $headers = @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.0' }
        $data = Invoke-RestMethod -Headers $headers -Uri $KimiReleasesApiUrl
        $tag = [string]$data.tag_name
        $m = [regex]::Match($tag, '(\d+\.\d+\.\d+)$')
        if ($m.Success) { return $m.Groups[1].Value }
    } catch {}
    return ''
}
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
        $release = Invoke-RestMethod -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='lazy-developer-installer/1.0.0' } -Uri $RtkApiUrl
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
        & $RtkExe init --agent kimi
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

Ensure-PythonRunner

$KimiExe = Find-Kimi
$KimiCurrentVersion = Get-KimiVersion $KimiExe
$KimiLatestVersion = Get-KimiLatestVersion
$KimiNeedsUpdate = $true
if ($KimiCurrentVersion) {
    if ($KimiLatestVersion) {
        if (Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion) {
            $KimiNeedsUpdate = $false
            if ($KimiCurrentVersion -eq $KimiLatestVersion) {
                Write-Host "Kimi Code $KimiCurrentVersion is already current — skipped."
            } else {
                Write-Host "Kimi Code $KimiCurrentVersion is newer than the latest published $KimiLatestVersion — skipped."
            }
        } else {
            Write-Host "Kimi Code $KimiCurrentVersion → $KimiLatestVersion — update required."
        }
    } else {
        $KimiNeedsUpdate = $false
        Write-Host "Kimi Code $KimiCurrentVersion is installed; latest release could not be checked — skipped."
    }
} else {
    Write-Host 'Kimi Code not found — installing the latest available release.'
}

$RemoteRevision = Get-GitHubRevision
if (-not $RemoteRevision) { Fail 'Could not read the current Lazy Developer revision from GitHub.' }
$InstalledLazyVersion = Get-InstalledLazyVersion
$InstalledLazyRevision = Get-InstalledLazyRevision
$Launcher = Join-Path $BinRoot 'lazydev.cmd'
$LazyInstallComplete = (Test-Path -LiteralPath (Join-Path $InstallRoot 'package.json') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'cli\lazydev.py') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-developer\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-debug\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-review\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'skills\lazy-test\SKILL.md') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $InstallRoot 'cli\lazydev.py') -PathType Leaf) -and
    (Test-Path -LiteralPath $Launcher -PathType Leaf)
$LazyDevNeedsUpdate = $true
if ($InstalledLazyVersion -and $InstalledLazyVersion -ne $LazyDevVersion) {
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

$RtkExe = Find-Rtk
$RtkCurrentVersion = Get-RtkVersion $RtkExe
$RtkLatestVersion = Get-RtkLatestVersion
$RtkNeedsUpdate = $true
if ($RtkExe -and $RtkCurrentVersion -and $RtkLatestVersion -and (Test-VersionAtLeast $RtkCurrentVersion $RtkLatestVersion)) {
    $RtkNeedsUpdate = $false
    Write-Host "RTK $RtkCurrentVersion is already current — skipped."
} elseif ($RtkExe -and -not $RtkLatestVersion) {
    $RtkNeedsUpdate = $false
    Write-Host "RTK $RtkCurrentVersion is installed; latest release could not be checked — skipped."
} elseif ($RtkExe) {
    $RtkCurrentDisplay = if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'unknown' }
    $RtkLatestDisplay = if ($RtkLatestVersion) { $RtkLatestVersion } else { 'latest' }
    Write-Host "RTK $RtkCurrentDisplay → $RtkLatestDisplay — update required."
} else {
    Write-Host 'RTK not found — installing.'
}

if ($KimiNeedsUpdate) {
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

if ($RtkNeedsUpdate) {
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
            if ($text -match 'Lazy Developer managed launcher|lazydev\.mjs|@blizps/lazy-developer|lazy-developer-free-kimi-code') {
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
        Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $archive
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $sourceDir = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
        if (-not $sourceDir) { Fail 'Downloaded Lazy Developer source could not be unpacked.' }
        $packageJson = Join-Path $sourceDir.FullName 'package.json'
        if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) { Fail 'Lazy Developer package.json was not found.' }
        $sourceVersion = ((Get-Content -Raw -LiteralPath $packageJson) | ConvertFrom-Json).version
        if ($sourceVersion -ne $LazyDevVersion) { Fail "Repository version is $sourceVersion; expected $LazyDevVersion." }
        Get-ChildItem -LiteralPath $sourceDir.FullName -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
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
