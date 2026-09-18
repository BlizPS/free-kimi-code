[CmdletBinding()]
param(
    [switch]$Help
)

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
$NodeBaseUrl = "https://nodejs.org/dist/v$NodeVersion"
$InstallRoot = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $env:LOCALAPPDATA 'LazyDeveloper' }
$BinRoot = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }

function Step([string]$Message) {
    Write-Host ''
    Write-Host "==> $Message"
}
function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

if ($Help) {
    @"
Lazy Developer installer

Installs or updates Kimi Code $KimiVersion and Lazy Developer $LazyDevVersion
without npm. It uses Kimi's native installer and a direct source install for LazyDev.

Run the same command again later to update or repair the installation.
"@ | Write-Host
    exit 0
}

function Get-NodeExecutable {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $version = (& node.exe --version 2>$null).Trim().TrimStart('v')
        $parts = $version.Split('.')
        if ($parts.Count -ge 2) {
            try {
                $major = [int]$parts[0]
                $minor = [int]$parts[1]
                if (($major -gt 22) -or (($major -eq 22) -and ($minor -ge 19))) { return $cmd.Source }
            } catch {}
        }
    }

    $archName = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($archName.ToUpperInvariant()) {
        'AMD64' { $asset = "node-v$NodeVersion-win-x64.zip" }
        'ARM64' { $asset = "node-v$NodeVersion-win-arm64.zip" }
        default { Fail "Unsupported Windows architecture: $archName" }
    }

    Step "Installing private Node.js $NodeVersion runtime"
    $tempNode = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-node-" + [guid]::NewGuid().ToString('N'))
    $archive = Join-Path $tempNode $asset
    $extract = Join-Path $tempNode 'extract'
    New-Item -ItemType Directory -Path $tempNode -Force | Out-Null
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUrl/$asset" -OutFile $archive
        $hashFile = Join-Path $tempNode 'SHASUMS256.txt'
        Invoke-WebRequest -UseBasicParsing -Uri "$NodeBaseUrl/SHASUMS256.txt" -OutFile $hashFile
        $expected = ((Get-Content -LiteralPath $hashFile | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1) -split '\s+')[0]
        if (-not $expected) { Fail "Could not find the Node.js checksum for $asset." }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
        if ($actual -ne $expected.ToLowerInvariant()) { Fail 'Node.js checksum verification failed.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $nodeExe = Get-ChildItem -LiteralPath $extract -Filter 'node.exe' -Recurse -File | Select-Object -First 1
        if (-not $nodeExe) { Fail 'Node.js binary was not found after extraction.' }
        return $nodeExe.FullName
    } finally {
        Remove-Item -LiteralPath $tempNode -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$NodeExe = Get-NodeExecutable
$KimiExe = $null

Step "Installing/updating Kimi Code $KimiVersion"
$env:KIMI_VERSION = $KimiVersion
$installerText = (Invoke-WebRequest -UseBasicParsing -Uri $KimiInstallUrl).Content
& ([scriptblock]::Create($installerText))

$kimiCandidates = @(
    (Join-Path $HOME '.kimi-code\bin\kimi.exe'),
    (Join-Path $HOME '.local\bin\kimi.exe')
)
$kimiPath = Get-Command kimi.exe -ErrorAction SilentlyContinue
if ($kimiPath) { $KimiExe = $kimiPath.Source }
if (-not $KimiExe) {
    foreach ($candidate in $kimiCandidates) {
        if (Test-Path -LiteralPath $candidate) { $KimiExe = $candidate; break }
    }
}
if (-not $KimiExe) { Fail "Kimi Code $KimiVersion did not install a usable 'kimi' launcher." }

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
    if (-not $sourceDir) { Fail 'Downloaded Lazy Developer source archive could not be unpacked.' }
    $packageJson = Join-Path $sourceDir.FullName 'package.json'
    if (-not (Test-Path -LiteralPath $packageJson)) { Fail 'Lazy Developer package.json was not found in the downloaded archive.' }
    Push-Location $sourceDir.FullName
    try { $sourceVersion = (& $NodeExe -e "console.log(require('./package.json').version)").Trim() } finally { Pop-Location }
    if ($sourceVersion -ne $LazyDevVersion) { Fail "Repository version is $sourceVersion; expected $LazyDevVersion." }
    Get-ChildItem -LiteralPath $sourceDir.FullName -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }

    # Keep a private Node binary when this machine did not already have a compatible Node.
    $nodeExisting = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeExisting) {
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
    $launcher = Join-Path $BinRoot 'lazydev.cmd'
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
    Set-Content -LiteralPath $launcher -Value $launcherContent -Encoding ASCII

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = if ($userPath) { $userPath -split ';' | Where-Object { $_ } } else { @() }
    if ($parts -notcontains $BinRoot) {
        [Environment]::SetEnvironmentVariable('Path', (($parts + $BinRoot) -join ';'), 'User')
    }
    if ($parts -notcontains (Join-Path $HOME '.local\bin')) {
        # Kept intentionally user-scoped and non-admin.
        $parts += (Join-Path $HOME '.local\bin')
        [Environment]::SetEnvironmentVariable('Path', (($parts | Select-Object -Unique) -join ';'), 'User')
    }
    $env:Path = "$BinRoot;$(Join-Path $HOME '.kimi-code\bin');$(Join-Path $HOME '.local\bin');$env:Path"

    Write-Host ''
    $kimiVersionText = (& $KimiExe --version 2>$null).Trim()
    $lazyVersionText = (& $launcher --version 2>$null).Trim()
    Write-Host "✓ Kimi Code: $kimiVersionText"
    Write-Host "✓ Lazy Developer: $lazyVersionText"
    Write-Host "✓ Install location: $InstallRoot"
    Write-Host ''
    Write-Host 'Next:'
    Write-Host '  lazydev setup'
    Write-Host '  lazydev chat'
    Write-Host ''
    Write-Host 'Run this same installer again whenever you want to update or repair Lazy Developer.'
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
