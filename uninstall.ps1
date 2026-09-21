[CmdletBinding()]
param([switch]$Help)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LazyDevHome = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.local\share\lazydev' }
$StateRoot = if ($env:XDG_STATE_HOME) { Join-Path $env:XDG_STATE_HOME 'lazydev' } else { Join-Path $HOME '.local\state\lazydev' }
$StateFile = Join-Path $StateRoot 'install-state.json'
$StateBackupFile = "$StateFile.bak"
$LazyDevBin = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.local\bin' }
$KimiBinRoot = Join-Path $HOME '.kimi-code\bin'
$RtkBinRoot = $LazyDevBin
$CodexBinRoot = $LazyDevBin
if (-not $env:LAZYDEV_BIN_DIR -and (Test-Path -LiteralPath $StateFile -PathType Leaf)) {
    try {
        $state = Get-Content -Raw -LiteralPath $StateFile | ConvertFrom-Json
        if ($state.bin_dir) { $LazyDevBin = [string]$state.bin_dir }
        if ($state.kimi_bin_dir) { $KimiBinRoot = [string]$state.kimi_bin_dir }
        if ($state.rtk_bin_dir) { $RtkBinRoot = [string]$state.rtk_bin_dir }
        if ($state.codex_bin_dir) { $CodexBinRoot = [string]$state.codex_bin_dir }
    } catch {}
}
$LazyDevConfig = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $env:APPDATA 'lazydev' }
$ArtifactDir = Join-Path $HOME 'lazydevfile'
    (Join-Path $env:APPDATA 'rtk'),
    (Join-Path $env:LOCALAPPDATA 'rtk')
)

if ($Help) {
@"
Lazy Developer uninstaller

This removes LazyDev-managed files, launchers, integrations, state, and artifacts.
Native Kimi Code, Codex, Antigravity, Claude Code, and RTK user data and session history are preserved.
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
    $commands = @(Get-Command lazydev,kimi,codex,agy,rtk -All -ErrorAction SilentlyContinue)
    foreach ($cmd in $commands) {
        $path = $cmd.Source
        if (-not $path) { continue }
        switch -Regex ($cmd.Name) {
            '^lazydev' { Remove-IfManagedFile $path 'Lazy Developer managed launcher|lazydev\.mjs|@blizps/lazy-developer|free-kimi-code' }
            '^kimi' { Remove-IfManagedFile $path '\.kimi-code|kimi-code|@moonshot-ai/kimi-code' }
            '^codex' { Remove-IfManagedFile $path 'openai/codex|Codex CLI' }
            '^agy' { Remove-IfManagedFile $path 'antigravity|google-antigravity' }
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
Stop-IfRunning 'codex'
Stop-IfRunning 'agy'
Stop-IfRunning 'rtk'

Write-Host "`n==> Removing Lazy Developer"
Remove-Item -LiteralPath $LazyDevHome -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$LazyDevHome.previous" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $LazyDevConfig -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'lazydev.cmd') -Force -ErrorAction SilentlyContinue

Write-Host "`n==> Removing Kimi Code launcher"
# Preserve ~/.kimi-code and ~/.kimi. Kimi Code stores configuration, credentials,
# logs, and session history there. Remove only launchers owned by this installer.
foreach ($file in @((Join-Path $KimiBinRoot 'kimi.exe'), (Join-Path $KimiBinRoot 'kimi.cmd'), (Join-Path $LazyDevBin 'kimi.exe'), (Join-Path $LazyDevBin 'kimi.cmd'), (Join-Path $HOME '.local\bin\kimi.exe'), (Join-Path $HOME '.local\bin\kimi.cmd'))) {
    if (Test-Path -LiteralPath $file -PathType Leaf) {
        try {
            $text = Get-Content -Raw -LiteralPath $file -ErrorAction Stop
            if ($text -match '\.kimi-code|kimi-code|@moonshot-ai/kimi-code|lazydev') { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
        } catch {}
    }
}

Write-Host "`n==> Removing Codex and Antigravity"
# Preserve native Codex and Antigravity data directories, including sessions and auth state.
$AgyMcpFile = Join-Path $HOME '.gemini\config\mcp_config.json'
if (Test-Path -LiteralPath $AgyMcpFile) {
    try {
        $mcp = Get-Content -Raw -LiteralPath $AgyMcpFile | ConvertFrom-Json
        if ($mcp.mcpServers -and ($mcp.mcpServers.PSObject.Properties.Name -contains 'lazydev-search')) {
            $mcp.mcpServers.PSObject.Properties.Remove('lazydev-search')
            if ($mcp.mcpServers.PSObject.Properties.Count -eq 0) {
                Remove-Item -LiteralPath $AgyMcpFile -Force -ErrorAction SilentlyContinue
            } else {
                $mcp | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $AgyMcpFile -Encoding UTF8
            }
        }
    } catch {}
}
foreach ($file in @('codex.exe','codex.cmd','codex','codex.bin')) {
    Remove-Item -LiteralPath (Join-Path $CodexBinRoot $file) -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $LazyDevBin $file) -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $HOME ('.local\bin\' + $file)) -Force -ErrorAction SilentlyContinue
}
foreach ($file in @('agy.exe','agy.cmd','agy')) {
    Remove-Item -LiteralPath (Join-Path $LazyDevBin $file) -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $HOME ('.local\bin\' + $file)) -Force -ErrorAction SilentlyContinue
}

Write-Host "`n==> Removing RTK"
$RtkExeCurrent = Get-Command rtk.exe -ErrorAction SilentlyContinue
if ($RtkExeCurrent) {
    & $RtkExeCurrent.Source gain *> $null
    if ($LASTEXITCODE -eq 0) { & $RtkExeCurrent.Source init -g --uninstall *> $null }
}
Remove-Item -LiteralPath (Join-Path $RtkBinRoot 'rtk.exe') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $LazyDevBin 'rtk.exe') -Force -ErrorAction SilentlyContinue
# Preserve native RTK config/data/cache; only remove the executable and the integration it owns.

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

Write-Host "`n==> Removing installer state"
Remove-Item -LiteralPath $StateRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n==> Checking cleanup"
$paths = @(
    $LazyDevHome,
    $LazyDevConfig,
    $StateRoot,
    (Join-Path $LazyDevBin 'lazydev.cmd'),
    (Join-Path $LazyDevBin 'rtk.exe'),
    (Join-Path $RtkBinRoot 'rtk.exe'),
    (Join-Path $CodexBinRoot 'codex.exe'),
    (Join-Path $LazyDevBin 'kimi.exe'),
    $ArtifactDir
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { throw "Cleanup incomplete: $path still exists." }
}

Write-Host ''
Write-Host 'Lazy Developer managed files, launchers, integrations, state, and artifacts have been removed. Native AI CLI and RTK user data were preserved.'
Write-Host 'Project directories outside these managed locations were left untouched.'
