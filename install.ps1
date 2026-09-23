# Lazy Developer Windows bootstrapper.
# Keep this file small and ASCII-only so irm / iex and ScriptBlock::Create are reliable in Windows PowerShell 5.1.
[CmdletBinding()]
param(
    [switch]$Help,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'BlizPS/free-kimi-code'
$Branch = if ($env:LAZYDEV_BRANCH) { $env:LAZYDEV_BRANCH } else { 'main' }
$CoreFileName = 'install-core.ps1'
$CoreUrl = "https://raw.githubusercontent.com/$Repo/$Branch/scripts/$CoreFileName"

function Invoke-LazyDownload([string]$Uri, [string]$OutFile) {
    $parent = Split-Path -Parent $OutFile
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

    $curl = Get-Command 'curl.exe' -ErrorAction SilentlyContinue
    if ($curl) {
        & $curl.Source '--fail' '--silent' '--show-error' '--location' '--http1.1' '--connect-timeout' '20' '--max-time' '300' '--retry' '5' '--retry-delay' '2' '--retry-max-time' '300' '--output' $OutFile $Uri
        if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $OutFile -PathType Leaf) -and ((Get-Item -LiteralPath $OutFile).Length -gt 0)) { return }
        Remove-Item -LiteralPath $OutFile -Force -ErrorAction SilentlyContinue
    }

    $client = $null
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $client = New-Object System.Net.Http.HttpClient
        $client.Timeout = [TimeSpan]::FromMinutes(10)
        $response = $client.GetAsync($Uri).GetAwaiter().GetResult()
        $response.EnsureSuccessStatusCode() | Out-Null
        $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        if (-not $bytes -or $bytes.Length -eq 0) { throw 'The server returned an empty response.' }
        [IO.File]::WriteAllBytes($OutFile, $bytes)
        return
    } catch {
        throw "Could not download $Uri. Check your internet connection, proxy/VPN, or TLS settings. $($_.Exception.Message)"
    } finally {
        if ($client) { $client.Dispose() }
    }
}


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
        Invoke-LazyDownload $CoreUrl $tempPath
        $corePath = $tempPath
    }

    $repoRoot = if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json') -PathType Leaf)) { $PSScriptRoot } elseif ($corePath) { Split-Path (Split-Path $corePath -Parent) -Parent } else { $null }
    if ($repoRoot -and (Test-Path -LiteralPath (Join-Path $repoRoot 'package.json') -PathType Leaf)) {
        $env:LAZYDEV_SOURCE_DIR = $repoRoot
    }

    $scriptArgs = @()
    if ($Help) { $scriptArgs += '-Help' }
    if ($DryRun) { $scriptArgs += '-DryRun' }

    # Execute the core in this PowerShell process. Spawning powershell.exe from an
    # irm | iex bootstrap can make the host look like it suddenly closed when the
    # child process terminates on some Windows terminal hosts.
    #
    # The core is read as text and run as an in-memory scriptblock (instead of
    # "& $corePath", which invokes the .ps1 file directly and is therefore
    # subject to the machine's Execution Policy). This mirrors how this very
    # bootstrapper is executed via "irm | iex" and avoids failures like:
    #   "... cannot be loaded because running scripts is disabled on this system."
    # on hosts with a Restricted/AllSigned policy, without changing the user's
    # system-wide Execution Policy.
    $coreContent = Get-Content -LiteralPath $corePath -Raw -Encoding UTF8
    $coreBlock = [scriptblock]::Create($coreContent)
    & $coreBlock @scriptArgs
    $code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    $global:LASTEXITCODE = $code
    if ($code -ne 0) {
        Write-Host "Lazy Developer installer finished with exit code $code." -ForegroundColor Red
    }
    return
} catch {
    Write-Host "Lazy Developer installer failed:" -ForegroundColor Red
    Write-Host ([string]$_.Exception.Message) -ForegroundColor Red
    $global:LASTEXITCODE = 1
    return
} finally {
    if ($tempPath) { Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue }
}
