param([switch]$Help)

if ($PSVersionTable.PSVersion.Major -lt 5 -or ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -lt 1)) { throw 'PowerShell 5.1 or newer is required.' }
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'BlizPS/free-kimi-code'
$Branch = 'main'
if ($env:LAZYDEV_BRANCH) { $Branch = $env:LAZYDEV_BRANCH }
$LazyDevVersion = '1.0.3'
$ArchiveUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
$RevisionUrl = "https://api.github.com/repos/$Repo/commits/$Branch"
$KimiInstallUrl = 'https://code.kimi.com/kimi-code/install.ps1'
$KimiReleasesUrl = 'https://api.github.com/repos/MoonshotAI/kimi-code/releases/latest'
$CodexInstallUrl = 'https://chatgpt.com/codex/install.ps1'
$CodexReleasesUrl = 'https://api.github.com/repos/openai/codex/releases/latest'
$AntigravityInstallUrl = 'https://antigravity.google/cli/install.ps1'
$AntigravityReleasesUrl = 'https://api.github.com/repos/google-antigravity/antigravity-cli/releases/latest'
$ClaudeInstallUrl = 'https://claude.ai/install.ps1'
$RtkReleasesUrl = 'https://api.github.com/repos/rtk-ai/rtk/releases/latest'
$DeepSeekHarnessPackage = '@deepseek-ai/dsh'
$DeepSeekHarnessVersion = '0.1.5-rc.2'
if ($env:LAZYDEV_DSH_VERSION) { $DeepSeekHarnessVersion = $env:LAZYDEV_DSH_VERSION }
$InstallRoot = if ($env:LAZYDEV_HOME) { $env:LAZYDEV_HOME } else { Join-Path $HOME '.localinree-kimi-code' }
$ConfigRoot = if ($env:LAZYDEV_CONFIG_DIR) { $env:LAZYDEV_CONFIG_DIR } else { Join-Path $HOME '.configree-kimi-code' }
$BinRoot = if ($env:LAZYDEV_BIN_DIR) { $env:LAZYDEV_BIN_DIR } else { Join-Path $HOME '.localin' }
$KimiBinRoot = Join-Path $HOME '.kimi-codein'
$RtkBinRoot = Join-Path $HOME '.localin'
$CodexBinRoot = Join-Path $HOME '.localin'
$UiRuntimeRoot = if ($env:LAZYDEV_UI_RUNTIME) { $env:LAZYDEV_UI_RUNTIME } else { Join-Path $ConfigRoot 'ui-runtime' }
$UiPackage = '@poppinss/cliui'
$UiVersion = '6.8.1'
$DeepSeekHarnessRuntime = if ($env:LAZYDEV_DSH_RUNTIME) { $env:LAZYDEV_DSH_RUNTIME } else { Join-Path $ConfigRoot 'deepseek-harness-runtime' }
$StateRoot = Join-Path $HOME '.localinree-kimi-code-state'
$StateFile = Join-Path $StateRoot 'install-state.json'

$KimiExe = $null; $CodexExe = $null; $AgyExe = $null; $ClaudeExe = $null; $RtkExe = $null; $DeepSeekHarnessExe = $null
$KimiCurrentVersion = ''; $CodexCurrentVersion = ''; $AgyCurrentVersion = ''; $ClaudeCurrentVersion = ''; $RtkCurrentVersion = ''; $DeepSeekHarnessCurrentVersion = ''
$KimiLatestVersion = ''; $CodexLatestVersion = ''; $AgyLatestVersion = ''; $RtkLatestVersion = ''
$InstallKimi = $false; $InstallCodex = $false; $InstallAntigravity = $false; $InstallClaude = $false; $InstallDeepSeekHarness = $false
$RtkNeedsUpdate = $false; $LazyDevNeedsUpdate = $true
$RemoteRevision = 'unknown'

function Step([string]$Message) { Write-Host "`n==> $Message" }
function Fail([string]$Message) { throw $Message }
function Get-CommandPath([string]$Name) {
    try { return (Get-Command $Name -ErrorAction Stop).Source } catch { return $null }
}
function Get-VersionFromText([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return '' }
    $m = [regex]::Match($Text, '\d+\.\d+\.\d+')
    if ($m.Success) { return $m.Value }
    return ''
}
function Test-VersionAtLeast([string]$Current,[string]$Required) {
    try { return ([version]$Current -ge [version]$Required) } catch { return $false }
}
function Get-JsonValue([string]$Url,[string]$Property) {
    try {
        $data = Invoke-RestMethod -UseBasicParsing -Uri $Url -Headers @{ 'Accept' = 'application/vnd.github+json'; 'User-Agent' = 'free-kimi-code-installer/1.0.3' }
        $value = $data.$Property
        if ($null -eq $value) { return '' }
        return [string]$value
    } catch { return '' }
}
function Get-ReleaseVersion([string]$Url) {
    return Get-VersionFromText (Get-JsonValue $Url 'tag_name')
}
function Refresh-Path {
    $paths = @($BinRoot,$CodexBinRoot,$RtkBinRoot,$KimiBinRoot)
    foreach ($p in $paths) {
        if ($p -and ($env:Path -notlike "*$p*")) { $env:Path = "$p;$env:Path" }
    }
}
function Add-UserPath([string]$PathEntry) {
    if ([string]::IsNullOrWhiteSpace($PathEntry)) { return }
    $userPath = [Environment]::GetEnvironmentVariable('Path','User')
    $parts = @()
    if ($userPath) { $parts = @($userPath -split ';' | Where-Object { $_ }) }
    if ($parts -notcontains $PathEntry) { $parts += $PathEntry }
    [Environment]::SetEnvironmentVariable('Path',($parts -join ';'),'User')
}
function Invoke-Download([string]$Url,[string]$Destination) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) { Fail "Download failed: $Url" }
    if ((Get-Item -LiteralPath $Destination).Length -eq 0) { Fail "Downloaded file was empty: $Url" }
}
function Invoke-DownloadedPowerShell([string]$Url,[string]$Label) {
    $file = Join-Path ([IO.Path]::GetTempPath()) ('free-kimi-code-' + [guid]::NewGuid().ToString('N') + '.ps1')
    try {
        Invoke-Download $Url $file
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $file
        if ($LASTEXITCODE -ne 0) { Fail "$Label installation failed with exit code $LASTEXITCODE." }
    } finally { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
}
function Ask-InstallUi([string]$Label) {
    $answer = Read-Host "$Label [Y/n]"
    if ([string]::IsNullOrEmpty($answer)) { return $true }
    switch ($answer) { 'n' { return $false } 'N' { return $false } 'no' { return $false } 'NO' { return $false } default { return $true } }
}
function Find-Kimi { $p = Get-CommandPath 'kimi'; if (-not $p) { $p = Get-CommandPath 'kimi-code' }; return $p }
function Find-Codex { return Get-CommandPath 'codex' }
function Find-Antigravity { $p = Get-CommandPath 'agy'; if (-not $p) { $p = Get-CommandPath 'antigravity' }; return $p }
function Find-Claude { return Get-CommandPath 'claude' }
function Find-Rtk { return Get-CommandPath 'rtk' }
function Find-Node { return Get-CommandPath 'node' }
function Find-Npm { return Get-CommandPath 'npm' }
function Find-DeepSeekHarness {
    $p = Get-CommandPath 'dsh'
    if ($p) { return $p }
    $candidate = Join-Path $DeepSeekHarnessRuntime 'node_modules\.bin\dsh.cmd'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    return $null
}
function Get-ExecutableVersion([string]$Path) {
    if (-not $Path) { return '' }
    try { return Get-VersionFromText ((& $Path --version 2>$null) -join "`n") } catch { return '' }
}
function Validate-LazyDevSource([string]$SourceDir) {
    $required = @('package.json','cli\lazydev.py','runtime\lazydev-dev-mcp.py','scripts\lazydev.mjs','skills\lazy-developer\SKILL.md','skills\lazy-debug\SKILL.md','skills\lazy-review\SKILL.md','skills\lazy-test\SKILL.md')
    foreach ($path in $required) { if (-not (Test-Path -LiteralPath (Join-Path $SourceDir $path) -PathType Leaf)) { return $false } }
    $cli = Get-Content -Raw -LiteralPath (Join-Path $SourceDir 'cli\lazydev.py')
    return ($cli -match 'lazydev resume') -and ($cli -match 'return chat\(resume=True\)') -and ($cli -match 'def find_kimi') -and ($cli -match 'def find_codex') -and ($cli -match 'def find_claude')
}
function Get-InstalledLazyVersion {
    $package = Join-Path $InstallRoot 'package.json'
    if (-not (Test-Path -LiteralPath $package -PathType Leaf)) { return '' }
    try { return [string]((Get-Content -Raw -LiteralPath $package | ConvertFrom-Json).version) } catch { return '' }
}
function Get-InstalledLazyRevision {
    $file = Join-Path $InstallRoot '.lazydev-revision'
    if (Test-Path -LiteralPath $file -PathType Leaf) { return (Get-Content -Raw -LiteralPath $file).Trim() }
    return ''
}
function Install-LazyDev {
    Step "Installing/updating Lazy Developer $LazyDevVersion"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('free-kimi-code-' + [guid]::NewGuid().ToString('N'))
    $archive = Join-Path $tmp 'source.zip'
    $extract = Join-Path $tmp 'extract'
    $stage = Join-Path $tmp 'stage'
    New-Item -ItemType Directory -Path $extract,$stage -Force | Out-Null
    try {
        Invoke-Download $ArchiveUrl $archive
        Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $source = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
        if (-not $source) { Fail 'Downloaded Lazy Developer source could not be unpacked.' }
        if (-not (Validate-LazyDevSource $source.FullName)) { Fail 'Downloaded Lazy Developer source failed capability validation.' }
        $version = Get-InstalledLazyVersion
        $remoteVersion = [string]((Get-Content -Raw -LiteralPath (Join-Path $source.FullName 'package.json') | ConvertFrom-Json).version)
        if ($remoteVersion -ne $LazyDevVersion) { Fail "Repository version is $remoteVersion; expected $LazyDevVersion." }
        Get-ChildItem -LiteralPath $source.FullName -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }
        Remove-Item -LiteralPath (Join-Path $stage '.git') -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $stage 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
        $old = "$InstallRoot.previous"
        if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue }
        if (Test-Path -LiteralPath $InstallRoot) { Move-Item -LiteralPath $InstallRoot -Destination $old -Force }
        New-Item -ItemType Directory -Path (Split-Path $InstallRoot -Parent) -Force | Out-Null
        Move-Item -LiteralPath $stage -Destination $InstallRoot -Force
        Set-Content -LiteralPath (Join-Path $InstallRoot '.lazydev-revision') -Value $RemoteRevision -Encoding ASCII
        New-Item -ItemType Directory -Path $BinRoot -Force | Out-Null
        $launcher = Join-Path $BinRoot 'lazydev.cmd'
        $lines = @('@echo off','setlocal',('set "LAZYDEV_ROOT=' + $InstallRoot + '"'),('set "PATH=' + $KimiBinRoot + ';%PATH%"'),'where py.exe >nul 2>&1','if not errorlevel 1 (','  py.exe -3 "%LAZYDEV_ROOT%\cli\lazydev.py" %*','  set "EXIT_CODE=%ERRORLEVEL%"','  endlocal & exit /b %EXIT_CODE%',')','where python.exe >nul 2>&1','if not errorlevel 1 (','  python.exe "%LAZYDEV_ROOT%\cli\lazydev.py" %*','  set "EXIT_CODE=%ERRORLEVEL%"','  endlocal & exit /b %EXIT_CODE%',')','where uv.exe >nul 2>&1','if not errorlevel 1 (','  uv.exe run --no-project --python 3.13 "%LAZYDEV_ROOT%\cli\lazydev.py" %*','  set "EXIT_CODE=%ERRORLEVEL%"','  endlocal & exit /b %EXIT_CODE%',')','echo LazyDev requires Python 3.10+ or uv. 1>&2','endlocal & exit /b 1')
        Set-Content -LiteralPath $launcher -Value $lines -Encoding ASCII
        Add-UserPath $BinRoot
        Add-UserPath $KimiBinRoot
        Refresh-Path
        Remove-Item -LiteralPath "$InstallRoot.previous" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Lazy Developer $LazyDevVersion ready"
    } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
function Install-Rtk {
    $release = Invoke-RestMethod -Headers @{ Accept='application/vnd.github+json'; 'User-Agent'='free-kimi-code-installer/1.0.3' } -Uri $RtkReleasesUrl
    $archName = $env:PROCESSOR_ARCHITEW6432
    if (-not $archName) { $archName = $env:PROCESSOR_ARCHITECTURE }
    $target = switch ($archName.ToUpperInvariant()) { 'AMD64' { 'x86_64-pc-windows-msvc' } 'ARM64' { 'aarch64-pc-windows-msvc' } default { Fail "Unsupported Windows architecture for RTK: $archName" } }
    $asset = $release.assets | Where-Object { $_.name -eq "rtk-$target.zip" } | Select-Object -First 1
    if (-not $asset) { Fail "RTK release does not contain rtk-$target.zip." }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('free-kimi-code-rtk-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        $archive = Join-Path $tmp $asset.name
        Invoke-Download $asset.browser_download_url $archive
        $hashAsset = $release.assets | Where-Object { $_.name -eq 'checksums.txt' } | Select-Object -First 1
        if (-not $hashAsset) { Fail 'RTK checksums.txt is missing from the release.' }
        $hashFile = Join-Path $tmp 'checksums.txt'; Invoke-Download $hashAsset.browser_download_url $hashFile
        $expectedLine = Get-Content -LiteralPath $hashFile | Where-Object { $_ -match [regex]::Escape($asset.name) } | Select-Object -First 1
        $expected = ''; if ($expectedLine) { $expected = ($expectedLine -split '\s+')[0].ToUpperInvariant() }
        if (-not $expected) { Fail "No checksum found for $($asset.name)." }
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToUpperInvariant()
        if ($actual -ne $expected) { Fail 'RTK checksum verification failed.' }
        $extract = Join-Path $tmp 'extract'; Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
        $exe = Get-ChildItem -LiteralPath $extract -Filter 'rtk.exe' -Recurse -File | Select-Object -First 1
        if (-not $exe) { Fail 'The RTK archive did not contain rtk.exe.' }
        New-Item -ItemType Directory -Path $RtkBinRoot -Force | Out-Null
        Copy-Item -LiteralPath $exe.FullName -Destination (Join-Path $RtkBinRoot 'rtk.exe') -Force
    } finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
function Install-UiRuntime {
    $node = Find-Node
    $npm = Find-Npm
    if (-not $node -or -not $npm) { Write-Host "CLI UI helper $UiVersion — skipped (Node.js/npm not available)."; return }
    $pkg = Join-Path $UiRuntimeRoot 'node_modules\@poppinss\cliui\package.json'
    $version = ''
    if (Test-Path -LiteralPath $pkg -PathType Leaf) { try { $version = [string]((Get-Content -Raw -LiteralPath $pkg | ConvertFrom-Json).version) } catch {} }
    if ($version -eq $UiVersion) { Write-Host "CLI UI helper $UiVersion is already current — skipped."; return }
    Step "Installing CLI UI helper $UiVersion"
    New-Item -ItemType Directory -Path $UiRuntimeRoot -Force | Out-Null
    $json = '{"name":"@blizps/lazydev-ui-runtime","private":true,"dependencies":{"' + $UiPackage + '":"' + $UiVersion + '"}}'
    Set-Content -LiteralPath (Join-Path $UiRuntimeRoot 'package.json') -Value $json -Encoding UTF8
    Push-Location $UiRuntimeRoot
    try { & $npm install --no-package-lock --ignore-scripts --omit=dev; if ($LASTEXITCODE -ne 0) { Write-Host 'CLI UI helper installation failed — native AI UIs remain available.'; return } } finally { Pop-Location }
    $ui = Join-Path $InstallRoot 'runtime\lazydev-ui.mjs'
    if (Test-Path -LiteralPath $ui -PathType Leaf) { Copy-Item -LiteralPath $ui -Destination (Join-Path $UiRuntimeRoot 'lazydev-ui.mjs') -Force }
    Write-Host "✓ CLI UI helper $UiVersion ready"
}
function Install-Kimi { Step 'Installing/updating Kimi Code to the latest available release'; Invoke-DownloadedPowerShell $KimiInstallUrl 'Kimi Code'; Refresh-Path; $script:KimiExe = Find-Kimi; if (-not $KimiExe) { Fail 'Kimi Code did not install a usable launcher.' }; $script:KimiCurrentVersion = Get-ExecutableVersion $KimiExe; Write-Host "✓ Kimi Code $(if ($KimiCurrentVersion) { $KimiCurrentVersion } else { 'installed' }) ready" }
function Install-Codex { Step 'Installing/updating official Codex CLI'; Invoke-DownloadedPowerShell $CodexInstallUrl 'Codex'; Refresh-Path; $script:CodexExe = Find-Codex; if (-not $CodexExe) { Fail 'Codex did not install a usable launcher.' }; $script:CodexCurrentVersion = Get-ExecutableVersion $CodexExe; Write-Host "✓ Codex $(if ($CodexCurrentVersion) { $CodexCurrentVersion } else { 'installed' }) ready" }
function Install-Antigravity { Step 'Installing/updating official Antigravity CLI'; Invoke-DownloadedPowerShell $AntigravityInstallUrl 'Antigravity'; Refresh-Path; $script:AgyExe = Find-Antigravity; if (-not $AgyExe) { Fail 'Antigravity did not install a usable launcher.' }; $script:AgyCurrentVersion = Get-ExecutableVersion $AgyExe; Write-Host "✓ Antigravity CLI $(if ($AgyCurrentVersion) { $AgyCurrentVersion } else { 'installed' }) ready" }
function Install-Claude { Step 'Installing/updating official Claude Code'; Invoke-DownloadedPowerShell $ClaudeInstallUrl 'Claude Code'; Refresh-Path; $script:ClaudeExe = Find-Claude; if (-not $ClaudeExe) { Fail 'Claude Code did not install a usable launcher.' }; $script:ClaudeCurrentVersion = Get-ExecutableVersion $ClaudeExe; Write-Host "✓ Claude Code $(if ($ClaudeCurrentVersion) { $ClaudeCurrentVersion } else { 'installed' }) ready" }
function Install-DeepSeekHarness {
    Step "Installing/updating DeepSeek Harness $DeepSeekHarnessVersion"
    $node = Find-Node; $npm = Find-Npm
    if (-not $node -or -not $npm) { Fail 'DeepSeek Harness needs Node.js and npm.' }
    New-Item -ItemType Directory -Path $DeepSeekHarnessRuntime -Force | Out-Null
    $json = '{"name":"@blizps/lazydev-deepseek-harness-runtime","private":true,"dependencies":{"' + $DeepSeekHarnessPackage + '":"' + $DeepSeekHarnessVersion + '"}}'
    Set-Content -LiteralPath (Join-Path $DeepSeekHarnessRuntime 'package.json') -Value $json -Encoding UTF8
    Push-Location $DeepSeekHarnessRuntime
    try { & $npm install --no-package-lock --include=optional --omit=dev; if ($LASTEXITCODE -ne 0) { Fail 'DeepSeek Harness installation failed.' } } finally { Pop-Location }
    $script:DeepSeekHarnessExe = Find-DeepSeekHarness
    if (-not $DeepSeekHarnessExe) { Fail 'DeepSeek Harness did not install a usable dsh launcher.' }
    $script:DeepSeekHarnessCurrentVersion = Get-ExecutableVersion $DeepSeekHarnessExe
    & $DeepSeekHarnessExe web --help *> $null
    if ($LASTEXITCODE -ne 0) { Fail 'DeepSeek Harness Web UI runtime is incomplete.' }
    Write-Host "✓ DeepSeek Harness $(if ($DeepSeekHarnessCurrentVersion) { $DeepSeekHarnessCurrentVersion } else { 'installed' }) ready"
}
function Save-State {
    New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null
    $data = [ordered]@{ version=$LazyDevVersion; revision=$RemoteRevision; lazydev=$InstallRoot; kimi=$KimiExe; codex=$CodexExe; antigravity=$AgyExe; claude=$ClaudeExe; dsh=$DeepSeekHarnessExe; rtk=$RtkExe }
    $data | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding UTF8
}

if ($Help) { Write-Host 'Free Kimi Code installer'; Write-Host 'Usage: install.ps1'; exit 0 }

$RemoteRevision = Get-JsonValue $RevisionUrl 'sha'
if (-not $RemoteRevision) { $RemoteRevision = 'unknown' }
Refresh-Path

$KimiExe = Find-Kimi; $CodexExe = Find-Codex; $AgyExe = Find-Antigravity; $ClaudeExe = Find-Claude; $RtkExe = Find-Rtk; $DeepSeekHarnessExe = Find-DeepSeekHarness
$KimiCurrentVersion = Get-ExecutableVersion $KimiExe; $CodexCurrentVersion = Get-ExecutableVersion $CodexExe; $AgyCurrentVersion = Get-ExecutableVersion $AgyExe; $ClaudeCurrentVersion = Get-ExecutableVersion $ClaudeExe; $RtkCurrentVersion = Get-ExecutableVersion $RtkExe; $DeepSeekHarnessCurrentVersion = Get-ExecutableVersion $DeepSeekHarnessExe
$KimiLatestVersion = Get-ReleaseVersion $KimiReleasesUrl; $CodexLatestVersion = Get-ReleaseVersion $CodexReleasesUrl; $AgyLatestVersion = Get-ReleaseVersion $AntigravityReleasesUrl; $RtkLatestVersion = Get-ReleaseVersion $RtkReleasesUrl

$KimiUpdate = $false; $CodexUpdate = $false; $AgyUpdate = $false; $ClaudeUpdate = $false; $DeepSeekUpdate = $false
if (-not $KimiExe) { $KimiUpdate = $true; Write-Host 'Kimi Code not found — installation available.' } elseif ($KimiLatestVersion -and $KimiCurrentVersion -and -not (Test-VersionAtLeast $KimiCurrentVersion $KimiLatestVersion)) { $KimiUpdate = $true; Write-Host "Kimi Code $KimiCurrentVersion → $KimiLatestVersion — update available." } else { Write-Host "Kimi Code $(if ($KimiCurrentVersion) { $KimiCurrentVersion } else { 'installed' }) is current — skipped." }
if (-not $CodexExe) { $CodexUpdate = $true; Write-Host 'Codex not found — installation available.' } elseif ($CodexLatestVersion -and $CodexCurrentVersion -and -not (Test-VersionAtLeast $CodexCurrentVersion $CodexLatestVersion)) { $CodexUpdate = $true; Write-Host "Codex $CodexCurrentVersion → $CodexLatestVersion — update available." } else { Write-Host "Codex $(if ($CodexCurrentVersion) { $CodexCurrentVersion } else { 'installed' }) is current — skipped." }
if (-not $AgyExe) { $AgyUpdate = $true; Write-Host 'Antigravity CLI not found — installation available.' } elseif ($AgyLatestVersion -and $AgyCurrentVersion -and -not (Test-VersionAtLeast $AgyCurrentVersion $AgyLatestVersion)) { $AgyUpdate = $true; Write-Host "Antigravity CLI $AgyCurrentVersion → $AgyLatestVersion — update available." } else { Write-Host "Antigravity CLI $(if ($AgyCurrentVersion) { $AgyCurrentVersion } else { 'installed' }) is current — skipped." }
if (-not $ClaudeExe) { $ClaudeUpdate = $true; Write-Host 'Claude Code not found — installation available.' } else { $ClaudeUpdate = $true }
$DeepSeekUpdate = $true
if (-not $DeepSeekHarnessExe) { Write-Host 'DeepSeek Harness not found — installation available.' }
if (-not $RtkExe) { $RtkNeedsUpdate = $true } else { Write-Host "RTK $(if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'installed' }) is installed — skipped." }

$installedLazyVersion = Get-InstalledLazyVersion
$installedLazyRevision = Get-InstalledLazyRevision
if ($installedLazyVersion -eq $LazyDevVersion -and $installedLazyRevision -eq $RemoteRevision -and (Test-Path -LiteralPath (Join-Path $BinRoot 'lazydev.cmd') -PathType Leaf)) { $LazyDevNeedsUpdate = $false; Write-Host "Lazy Developer $LazyDevVersion is already current — skipped." }

if ($KimiUpdate) { $InstallKimi = Ask-InstallUi 'Install/update Kimi Code?' }
if ($CodexUpdate) { $InstallCodex = Ask-InstallUi 'Install/update Codex?' }
if ($AgyUpdate) { $InstallAntigravity = Ask-InstallUi 'Install/update Antigravity?' }
if ($ClaudeUpdate) { $InstallClaude = Ask-InstallUi 'Install/update Claude Code?' }
if ($DeepSeekUpdate) { $InstallDeepSeekHarness = Ask-InstallUi 'Install/update DeepSeek Harness?' }

Clear-Host
if ($RtkNeedsUpdate) { Install-Rtk; Refresh-Path; $script:RtkExe = Find-Rtk; if (-not $RtkExe) { Fail 'RTK did not install a usable launcher.' } $script:RtkCurrentVersion = Get-ExecutableVersion $RtkExe; Write-Host "✓ RTK $(if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'installed' }) ready" } else { Write-Host "✓ RTK $(if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'installed' }) already current — skipped." }
if ($LazyDevNeedsUpdate) { Install-LazyDev } else { Write-Host 'Lazy Developer setup — skipped. Configure providers later with: lazydev setup' }

$lazydevLauncher = Join-Path $BinRoot 'lazydev.cmd'
if (-not (Test-Path -LiteralPath $lazydevLauncher -PathType Leaf)) { Fail 'Lazy Developer launcher was not created.' }
Refresh-Path
try { $helpText = & $lazydevLauncher help 2>&1 | Out-String } catch { $helpText = $_ | Out-String }
if ($LASTEXITCODE -ne 0) { Write-Host $helpText; Fail 'Lazy Developer launcher did not execute after refresh.' }
if (($helpText -notmatch 'lazydev resume') -or ($helpText -match 'lazydev sessions')) { Write-Host $helpText; Fail 'Lazy Developer command surface is stale: expected lazydev resume and no lazydev sessions.' }

Install-UiRuntime
if ($RtkExe -and $KimiExe) {
    Step 'Connecting RTK to Kimi Code'
    $kimiRuntime = Join-Path $ConfigRoot 'kimi-code'
    New-Item -ItemType Directory -Path $kimiRuntime -Force | Out-Null
    Push-Location $kimiRuntime
    try { & $RtkExe init --agent kimi --auto-patch; if ($LASTEXITCODE -ne 0) { Fail 'RTK Kimi integration failed.' } } finally { Pop-Location }
    Write-Host '✓ RTK is connected to Kimi Code'
}

if ($InstallKimi) { Install-Kimi }
if ($InstallCodex) { Install-Codex }
if ($InstallAntigravity) { Install-Antigravity }
if ($InstallClaude) { Install-Claude }
if ($InstallDeepSeekHarness) { Install-DeepSeekHarness }

Refresh-Path
if (-not $KimiExe) { $KimiExe = Find-Kimi }
if (-not $CodexExe) { $CodexExe = Find-Codex }
if (-not $AgyExe) { $AgyExe = Find-Antigravity }
if (-not $ClaudeExe) { $ClaudeExe = Find-Claude }
if (-not $RtkExe) { $RtkExe = Find-Rtk }
if (-not $DeepSeekHarnessExe) { $DeepSeekHarnessExe = Find-DeepSeekHarness }
Save-State

$KimiDisplayFinal = if ($KimiCurrentVersion) { $KimiCurrentVersion } else { 'unknown' }
$RtkDisplayFinal = if ($RtkCurrentVersion) { $RtkCurrentVersion } else { 'unknown' }
Write-Host ''
Write-Host 'Lazy Developer installer finished.'
Write-Host "Kimi Code: $KimiDisplayFinal"
Write-Host "RTK: $RtkDisplayFinal"
Write-Host "Lazy Developer: $LazyDevVersion"
Write-Host 'Existing Kimi sessions and configuration were left in place.'
Write-Host ''
Write-Host 'Provider setup is intentionally separate and was not run by the installer.'
Write-Host 'Claude Code and DeepSeek Harness use the configured LazyDev local route when launched from lazydev chat.'
Write-Host 'Next:'
Write-Host '  lazydev setup'
Write-Host '  lazydev chat'
Write-Host '  lazydev resume'
