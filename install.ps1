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

    # Execute the core via a child PowerShell process with the Execution Policy
    # bypassed for that process only (this does NOT change the user's
    # system-wide Execution Policy). This is the same pattern already used
    # elsewhere in install-core.ps1 for the Kimi/Codex/Antigravity/Claude/uv
    # sub-installers, so it is a proven-safe way to run a downloaded .ps1 file
    # without hitting:
    #   "... cannot be loaded because running scripts is disabled on this system."
    #
    # An earlier version of this bootstrap tried to avoid spawning a child
    # process by re-parsing the core script's text in-process via
    # [scriptblock]::Create(). That re-parse is fragile for a script this
    # large (it can corrupt or mis-tokenize content, such as embedded
    # batch-script fragments and special characters, producing spurious
    # "Missing closing ')'/'}'" parse errors that do not occur when the file
    # is loaded normally). Running the file directly, just with the policy
    # bypassed, avoids that class of bug entirely. The console is not
    # redirected, so interactive Y/n prompts in the core script still work.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $corePath @scriptArgs
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
