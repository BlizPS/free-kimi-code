[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LazyDevHome = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$LazyDevBin = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }
$LazyDevConfig = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $env:APPDATA 'lazydev' }
$KimiNativeHome = Join-Path $HOME '.kimi-code'
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
Remove-Item -LiteralPath $KimiNativeHome -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $HOME '.local\bin\kimi.exe') -Force -ErrorAction SilentlyContinue
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    & npm.cmd uninstall -g @blizps/lazy-developer @moonshot-ai/kimi-code *> $null
    $global:LASTEXITCODE = 0
}

Write-Host "`n==> Removing RTK"
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'rtk.exe') -Force -ErrorAction SilentlyContinue
foreach ($dir in $RtkConfigs) {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==> Removing LazyDev workspace artifacts"
Remove-Item -LiteralPath $ArtifactDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n==> Cleaning user PATH entries"
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
    (Join-Path $LazyDevBin 'lazydev.cmd'),
    (Join-Path $LazyDevBin 'rtk.exe'),
    $ArtifactDir
) + $RtkConfigs
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { throw "Cleanup incomplete: $path still exists." }
}

Write-Host ''
Write-Host 'Lazy Developer, Kimi Code, RTK, managed configuration, sessions, caches, and LazyDev artifacts have been removed.'
Write-Host 'Project directories outside these managed locations were left untouched.'
