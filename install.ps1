# Lazy Developer Windows bootstrapper.
# Keep this file small and ASCII-only so irm / iex and ScriptBlock::Create are reliable in Windows PowerShell 5.1.
[CmdletBinding()]
param(
    [switch]$Help,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Repo = 'BlizPS/free-kimi-code'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }
$CoreFileName = 'install-core.ps1'
$CoreUrl = "https://raw.githubusercontent.com/$Repo/$Branch/scripts/$CoreFileName"

function Get-LocalCorePath {
    if (-not $PSScriptRoot) { return $null }
    $direct = Join-Path $PSScriptRoot $CoreFileName
    if (Test-Path -LiteralPath $direct -PathType Leaf) { return $direct }
    $scripts = Join-Path $PSScriptRoot 'scripts'
    $nested = Join-Path $scripts $CoreFileName
    if (Test-Path -LiteralPath $nested -PathType Leaf) { return $nested }
    return $null
}

$corePath = Get-LocalCorePath
$tempPath = $null
try {
    if (-not $corePath) {
        $tempPath = Join-Path ([IO.Path]::GetTempPath()) ("lazydev-install-core-" + [guid]::NewGuid().ToString('N') + '.ps1')
        Invoke-WebRequest -UseBasicParsing -Uri $CoreUrl -OutFile $tempPath
        $corePath = $tempPath
    }

    $repoRoot = if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json') -PathType Leaf)) { $PSScriptRoot } elseif ($corePath) { Split-Path (Split-Path $corePath -Parent) -Parent } else { $null }
    if ($repoRoot -and (Test-Path -LiteralPath (Join-Path $repoRoot 'package.json') -PathType Leaf)) {
        $env:LAZYDEV_SOURCE_DIR = $repoRoot
    }

    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $corePath)
    if ($Help) { $args += '-Help' }
    if ($DryRun) { $args += '-DryRun' }
    & powershell.exe @args
    exit $LASTEXITCODE
} catch {
    Write-Error $_
    exit 1
} finally {
    if ($tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
}
