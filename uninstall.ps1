[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LazyDevHome = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$LazyDevBin = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }
$LazyDevConfig = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $env:APPDATA 'lazydev' }
$KimiNativeHome = Join-Path $HOME '.kimi-code'
$KimiLegacyHome = Join-Path $HOME '.kimi'
$KimiLegacyDirs = @($KimiLegacyHome, (Join-Path $env:APPDATA 'kimi'), (Join-Path $env:APPDATA 'kimi-code'), (Join-Path $env:LOCALAPPDATA 'kimi'), (Join-Path $env:LOCALAPPDATA 'kimi-code'))
$RtkDataDirs = @((Join-Path $HOME '.local\share\rtk'), (Join-Path $HOME '.cache\rtk'))
$ArtifactDir = Join-Path $HOME 'lazydevfile'
$RtkConfigs = @(
    (Join-Path $env:APPDATA 'rtk'),
    (Join-Path $env:LOCALAPPDATA 'rtk')
)

if ($Help) {
@"
Lazy Developer uninstaller

This removes the Lazy Developer installation, Kimi Code, RTK, managed configuration,
sessions, caches, the LazyDev artifact directory, and the launchers created by this project.
Project directories outside those managed locations are left untouched.

To reinstall later, run the Lazy Developer installer again.
"@ | Write-Host
exit 0
}

function Remove-IfManagedFile([string]$Path, [string]$Pattern) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        $text = Get-Content -Raw -LiteralPath $Path -ErrorAction Stop
        if ($text -match $Pattern) { Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue }
    } catch {}
}
function Remove-CommandShims {
    $commands = @(Get-Command lazydev,kimi,rtk -All -ErrorAction SilentlyContinue)
    foreach ($cmd in $commands) {
        $path = $cmd.Source
        if (-not $path) { continue }
        switch -Regex ($cmd.Name) {
            '^lazydev' { Remove-IfManagedFile $path 'Lazy Developer managed launcher|lazydev\.mjs|@blizps/lazy-developer|lazy-developer-free-kimi-code' }
            '^kimi' { Remove-IfManagedFile $path '\.kimi-code|kimi-code|@moonshot-ai/kimi-code' }
            '^rtk' { Remove-IfManagedFile $path 'rtk-ai/rtk|Rust Token Killer' }
        }
    }
}

function Stop-IfRunning([string]$Name) {
    $items = @(Get-Process -Name $Name -ErrorAction SilentlyContinue)
    if ($items.Count -gt 0) { throw "$Name is still running. Stop it, then rerun uninstall." }
}
function Stop-LazyDevProcess {
    $items = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine -match 'lazydev\.mjs'
    })
    if ($items.Count -gt 0) { throw 'Lazy Developer is still running. Stop it, then rerun uninstall.' }
}

Write-Host "`n==> Checking running processes"
Stop-LazyDevProcess
Stop-IfRunning 'kimi'
Stop-IfRunning 'rtk'

Write-Host "`n==> Removing Lazy Developer"
Remove-Item -LiteralPath $LazyDevHome -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$LazyDevHome.previous" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $LazyDevConfig -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'lazydev.cmd') -Force -ErrorAction SilentlyContinue

Write-Host "`n==> Removing Kimi Code"
foreach ($dir in @($KimiNativeHome) + $KimiLegacyDirs) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}
foreach ($dir in @((Join-Path $HOME '.local\share\kimi-code'), (Join-Path $HOME '.cache\kimi-code'), (Join-Path $HOME '.local\state\kimi-code'))) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'kimi.exe') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'kimi.cmd') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $HOME '.local\bin\kimi.exe') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $HOME '.local\bin\kimi.cmd') -Force -ErrorAction SilentlyContinue
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    & npm.cmd uninstall -g @blizps/lazy-developer @moonshot-ai/kimi-code *> $null
    $global:LASTEXITCODE = 0
}
$LegacyNpmRoots = @(
    (Join-Path $env:APPDATA 'npm\node_modules'),
    (Join-Path $env:LOCALAPPDATA 'npm\node_modules'),
    (Join-Path $HOME '.npm-global\node_modules')
)
foreach ($npmRoot in $LegacyNpmRoots) {
    Remove-Item -LiteralPath (Join-Path $npmRoot '@blizps\lazy-developer') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $npmRoot '@moonshot-ai\kimi-code') -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==> Removing RTK"
$RtkExeCurrent = Get-Command rtk.exe -ErrorAction SilentlyContinue
if ($RtkExeCurrent) {
    & $RtkExeCurrent.Source gain *> $null
    if ($LASTEXITCODE -eq 0) { & $RtkExeCurrent.Source init -g --uninstall *> $null }
}
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'rtk.exe') -Force -ErrorAction SilentlyContinue
foreach ($dir in $RtkConfigs) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}
foreach ($dir in $RtkDataDirs) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==> Removing LazyDev workspace artifacts"
Remove-Item -LiteralPath $ArtifactDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n==> Cleaning user PATH entries"
Remove-CommandShims

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
    $entries = @($userPath -split ';' | Where-Object { $_ })
    $remove = @($LazyDevBin, (Join-Path $HOME '.kimi-code\bin'))
    $entries = @($entries | Where-Object { $remove -notcontains $_ })
    [Environment]::SetEnvironmentVariable('Path', ($entries -join ';'), 'User')
    $env:Path = (($entries -join ';') + ';' + $env:Path)
}

Write-Host "`n==> Checking cleanup"
$paths = @(
    $LazyDevHome,
    $LazyDevConfig,
    $KimiNativeHome,
    $KimiLegacyHome,
    (Join-Path $LazyDevBin 'lazydev.cmd'),
    (Join-Path $LazyDevBin 'rtk.exe'),
    (Join-Path $LazyDevBin 'kimi.exe'),
    $ArtifactDir
) + $RtkConfigs + $RtkDataDirs + $KimiLegacyDirs
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { throw "Cleanup incomplete: $path still exists." }
}

Write-Host ''
Write-Host 'Lazy Developer, Kimi Code, RTK, managed configuration, sessions, caches, and LazyDev artifacts have been removed.'
Write-Host 'Project directories outside these managed locations were left untouched.'
