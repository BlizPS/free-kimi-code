[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'BlizPS/lazy-developer-skill-cli'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }
$LazyDevVersion = '1.0.0'
$KimiVersion = '0.43.1'
$NodeVersion = '22.19.0'
$KimiInstallUrl = 'https://code.kimi.com/kimi-code/install.ps1'
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$GitHubApiUrl = "https://api.github.com/repos/$Repo/commits/$Branch"
$NodeBaseUrl = "https://nodejs.org/dist/v$NodeVersion"
$InstallRoot = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$BinRoot = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }

function Step([string]$Message) { Write-Host "`n==> $Message" }
function Fail([string]$Message) { Write-Error $Message; exit 1 }
function Get-VersionFromText([string]$Text) {
    $m = [regex]::Match($Text, '(\d+\.\d+\.\d+)')
    if ($m.Success) { return $m.Groups[1].Value }
    return ''
}
function Test-VersionAtLeast([string]$Current, [string]$Required) {
    try { return ([version]$Current -ge [version]$Required) } catch { return $false }
}
function Find-Kimi {
    $cmd = Get-Command kimi.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command kimi -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @(
        (Join-Path $HOME '.kimi-code\bin\kimi.exe'),
        (Join-Path $HOME '.local\bin\kimi.exe')
    )) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return $null
}
function Get-KimiVersion([string]$KimiExe) {
    if (-not $KimiExe) { return '' }
    try { return Get-VersionFromText ((& $KimiExe --version 2>$null) -join "`n") } catch { return '' }
}
function Get-GitHubRevision {
    $headers = @{ 'Accept' = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'lazy-developer-installer/1.0.0' }
    try {
        $data = Invoke-RestMethod -UseBasicParsing -Headers $headers -Uri $GitHubApiUrl
        if ($data.sha -match '^[0-9a-fA-F]{40}$') { return $data.sha }
    } catch { }
    return $null
}
function Get-InstalledLazyVersion {
    $packageJson = Join-Path $InstallRoot 'package.json'
    if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) { return '' }
    try { return ([IO.File]::ReadAllText($packageJson) | ConvertFrom-Json).version } catch { return '' }
}
function Get-InstalledLazyRevision {
    $file = Join-Path $InstallRoot '.lazydev-revision'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return '' }
    try { return ([IO.File]::ReadAllText($file)).Trim() } catch { return '' }
}
function Get-NodeExecutable {
    $script:NodeIsPrivate = $false
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        try {
            if (Test-VersionAtLeast (Get-VersionFromText ((& node.exe --version 2>$null) -join "`n")) $NodeVersion) { return $cmd.Source }
        } catch {}
    }
    $private = Join-Path $InstallRoot 'runtime-node\node.exe'
    if (Test-Path -LiteralPath $private -PathType Leaf) {
        try {
            if (Test-VersionAtLeast (Get-VersionFromText ((& $private --version 2>$null) -join "`n")) $NodeVersion) { $script:NodeIsPrivate = $true; return $private }
        } catch {}
    }
    $archName = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($archName.ToUpperInvariant()) {
        'AMD64' { $asset = "node-v$NodeVersion-win-x64.zip" }
        'ARM64' { $asset = "node-v$NodeVersion-win-arm64.zip" }
        default { Fail "Unsupported Windows architecture: $archName" }
    }
    Step "Installing private Node.js $NodeVersion runtime"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-node-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        $archive = Join-Path $tmp $asset
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUrl/$asset" -OutFile $archive
        $hashFile = Join-Path $tmp 'SHASUMS256.txt'
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUrl/SHASUMS256.txt" -OutFile $hashFile
        $expected = ((Get-Content -LiteralPath $hashFile | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1) -split '\s+')[0]
        if (-not $expected) { Fail "Could not find the Node.js checksum for $asset." }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
        if ($actual -ne $expected) { Fail 'Node.js checksum verification failed.' }
        $extract = Join-Path $tmp 'extract'
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $node = Get-ChildItem -LiteralPath $extract -Filter 'node.exe' -Recurse -File | Select-Object -First 1
        if (-not $node) { Fail 'Node.js binary was not found after extraction.' }
        $script:NodeIsPrivate = $true
        return $node.FullName
    } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($Help) {
@"
Lazy Developer installer

Installs or updates Kimi Code $KimiVersion and Lazy Developer $LazyDevVersion without npm.
The same command can be run again safely: unchanged components are skipped.
Kimi sessions and LazyDev configuration are preserved during LazyDev updates.
"@ | Write-Host
exit 0
}

$KimiExe = Find-Kimi
$KimiCurrentVersion = Get-KimiVersion $KimiExe
$KimiNeedsUpdate = $true
if ($KimiCurrentVersion -and (Test-VersionAtLeast $KimiCurrentVersion $KimiVersion)) {
    $KimiNeedsUpdate = $false
    Write-Host "Kimi Code $KimiCurrentVersion is already current (minimum managed version $KimiVersion) — skipped."
} elseif ($KimiExe) {
    Write-Host "Kimi Code $KimiCurrentVersion needs installation/update."
} else {
    Write-Host "Kimi Code not found — installing $KimiVersion."
}

$RemoteRevision = Get-GitHubRevision
if (-not $RemoteRevision) { Fail 'Could not read the current Lazy Developer revision from GitHub. Refusing to guess whether an update is needed.' }
$InstalledLazyVersion = Get-InstalledLazyVersion
$InstalledLazyRevision = Get-InstalledLazyRevision
$Launcher = Join-Path $BinRoot 'lazydev.cmd'
$LazyDevNeedsUpdate = $true
if ($InstalledLazyVersion -and $InstalledLazyVersion -ne $LazyDevVersion) {
    Write-Host "Lazy Developer version $InstalledLazyVersion differs from managed version $LazyDevVersion — update required."
} elseif ($InstalledLazyRevision -and ($InstalledLazyRevision -eq $RemoteRevision) -and (Test-Path -LiteralPath $Launcher -PathType Leaf)) {
    $LazyDevNeedsUpdate = $false
    Write-Host "Lazy Developer $LazyDevVersion is already current at $RemoteRevision — skipped."
} elseif ($InstalledLazyRevision) {
    Write-Host "Lazy Developer has a newer GitHub revision ($InstalledLazyRevision → $RemoteRevision) — updating Lazy Developer only."
} else {
    Write-Host 'Lazy Developer revision metadata/launcher is missing — repairing Lazy Developer.'
}

if ($KimiNeedsUpdate) {
    Step "Installing/updating Kimi Code $KimiVersion"
    $env:KIMI_VERSION = $KimiVersion
    $installerText = (Invoke-WebRequest -UseBasicParsing -Uri $KimiInstallUrl).Content
    & ([scriptblock]::Create($installerText))
    $KimiExe = Find-Kimi
    if (-not $KimiExe) { Fail "Kimi Code did not install a usable 'kimi' launcher." }
    $KimiCurrentVersion = Get-KimiVersion $KimiExe
    if (-not $KimiCurrentVersion -or -not (Test-VersionAtLeast $KimiCurrentVersion $KimiVersion)) { Fail "Installed Kimi Code is $KimiCurrentVersion; expected at least $KimiVersion." }
    Write-Host "✓ Kimi Code $KimiCurrentVersion ready"
}

if ($LazyDevNeedsUpdate) {
    $NodeExe = Get-NodeExecutable
    Step "Updating Lazy Developer $LazyDevVersion"
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
        if (-not $sourceDir) { Fail 'Downloaded Lazy Developer source archive could not be unpacked.' }
        $packageJson = Join-Path $sourceDir.FullName 'package.json'
        if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) { Fail 'Lazy Developer package.json was not found in the downloaded archive.' }
        $sourceVersion = ((Get-Content -Raw -LiteralPath $packageJson) | ConvertFrom-Json).version
        if ($sourceVersion -ne $LazyDevVersion) { Fail "Repository version is $sourceVersion; expected $LazyDevVersion." }
        Get-ChildItem -LiteralPath $sourceDir.FullName -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
        Set-Content -LiteralPath (Join-Path $stage '.lazydev-revision') -Value $RemoteRevision -Encoding ASCII
        if ($script:NodeIsPrivate) {
            New-Item -ItemType Directory -Path (Join-Path $stage 'runtime-node') -Force | Out-Null
            Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $stage 'runtime-node\node.exe') -Force
        }
        if (Test-Path -LiteralPath $InstallRoot) {
            Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue
            Move-Item -LiteralPath $InstallRoot -Destination "$InstallRoot.previous" -Force
        }
        New-Item -ItemType Directory -Path (Split-Path $InstallRoot -Parent) -Force | Out-Null
        Move-Item -LiteralPath $stage -Destination $InstallRoot -Force
        Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue

        New-Item -ItemType Directory -Path $BinRoot -Force | Out-Null
        $nodeForLauncher = if (Test-Path -LiteralPath (Join-Path $InstallRoot 'runtime-node\node.exe')) { Join-Path $InstallRoot 'runtime-node\node.exe' } else { $NodeExe }
        $launcherContent = @"
@echo off
setlocal
set "LAZYDEV_ROOT=$InstallRoot"
set "KIMI_BIN=$([IO.Path]::GetDirectoryName($KimiExe))"
set "PATH=%KIMI_BIN%;%USERPROFILE%\.kimi-code\bin;%USERPROFILE%\.local\bin;%PATH%"
if exist "%LAZYDEV_ROOT%\runtime-node\node.exe" (
  set "NODE_BIN=%LAZYDEV_ROOT%\runtime-node\node.exe"
) else (
  set "NODE_BIN=$nodeForLauncher"
)
"%NODE_BIN%" "%LAZYDEV_ROOT%\scripts\lazydev.mjs" %*
endlocal
"@
        Set-Content -LiteralPath $Launcher -Value $launcherContent -Encoding ASCII
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $parts = if ($userPath) { $userPath -split ';' | Where-Object { $_ } } else { @() }
        if ($parts -notcontains $BinRoot) { $parts += $BinRoot }
        if ($parts -notcontains (Join-Path $HOME '.kimi-code\bin')) { $parts += (Join-Path $HOME '.kimi-code\bin') }
        if ($parts -notcontains (Join-Path $HOME '.local\bin')) { $parts += (Join-Path $HOME '.local\bin') }
        [Environment]::SetEnvironmentVariable('Path', (($parts | Select-Object -Unique) -join ';'), 'User')
        $env:Path = "$BinRoot;$(Join-Path $HOME '.kimi-code\bin');$(Join-Path $HOME '.local\bin');$env:Path"
        Write-Host "✓ Lazy Developer $LazyDevVersion updated"
    } finally { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host 'Lazy Developer installer finished.'
Write-Host "Kimi Code: $(if ($KimiExe) { (Get-KimiVersion $KimiExe) } else { 'installed/checked' })"
Write-Host "Lazy Developer: $LazyDevVersion"
Write-Host 'Kimi sessions and saved configuration are preserved; the updater does not remove Kimi data.'
Write-Host ''
Write-Host 'Next:'
Write-Host '  lazydev setup'
Write-Host '  lazydev chat'
