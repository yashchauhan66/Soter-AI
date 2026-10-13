param([Parameter(Mandatory=$true)][string]$CodePath, [string]$OutputRoot, [switch]$DisableUniqueEvidence,
    [string]$ExtensionRoot, [switch]$UsePrebuilt, [string]$HostTestsPath)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$extensionRoot = if ($ExtensionRoot) { [IO.Path]::GetFullPath($ExtensionRoot) } else { Join-Path $repoRoot 'packages/vscode-extension' }
if (-not $extensionRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'ExtensionRoot must stay inside the workspace.' }
if ($DisableUniqueEvidence) { throw 'Unique evidence recording is disabled; host execution is unavailable.' }
function Write-NewText([string]$file,[string]$value) {
    $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {$bytes=[Text.UTF8Encoding]::new($false).GetBytes($value);$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
}
if (-not $OutputRoot) { $OutputRoot = Join-Path $repoRoot 'docs/secretguard/guarantee-program-2026-10-09/phase4/evidence/host-runs' }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
if (-not $OutputRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'OutputRoot must stay inside this repository.' }
$cursor=$OutputRoot
while ($cursor.Length -gt $repoRoot.Length) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked output refused.' }
    $cursor=Split-Path -Parent $cursor
}
$runId = 'host-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N')
$runRoot = Join-Path $OutputRoot $runId
if (Test-Path -LiteralPath $runRoot) { throw 'Run output already exists; refusing overwrite.' }
[void][IO.Directory]::CreateDirectory($runRoot)
if (-not $UsePrebuilt) {
    & npm.cmd --prefix $extensionRoot run build
    if ($LASTEXITCODE -ne 0) { throw 'Extension rebuild failed; no host execution.' }
}
foreach ($name in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')) {
    if (-not (Test-Path -LiteralPath (Join-Path $extensionRoot ('dist/' + $name)) -PathType Leaf)) { throw 'Complete prebuilt extension required.' }
}
$bundle = Join-Path $runRoot 'security-review-host.js'
if ($HostTestsPath) {
    if (-not $UsePrebuilt -or -not (Test-Path -LiteralPath $HostTestsPath -PathType Leaf)) { throw 'Verified prebuilt host input required.' }
    Copy-Item -LiteralPath $HostTestsPath -Destination $bundle
} else {
    & node.exe (Join-Path $repoRoot 'node_modules/esbuild/bin/esbuild') (Join-Path $repoRoot 'packages/vscode-extension/src/__tests__/host/securityReview.host.ts') --bundle --platform=node --external:vscode "--outfile=$bundle"
    if ($LASTEXITCODE -ne 0) { throw 'Existing host harness build failed; no host execution.' }
}
$launchRecord = @{ runId=$runId; status='PREPARED_NOT_RUN'; createdAt=[DateTime]::UtcNow.ToString('o'); extensionBundleSha256=(Get-FileHash -LiteralPath (Join-Path $extensionRoot 'dist/extension.js')).Hash.ToLowerInvariant(); hostProbeSha256=(Get-FileHash -LiteralPath $bundle).Hash.ToLowerInvariant(); codeSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant(); extensionDevelopmentPath=$extensionRoot; limitation='Working-tree launch; hashes identify prepared bytes, not an immutable complete runtime.' }
Write-NewText (Join-Path $runRoot 'launch.json') ($launchRecord | ConvertTo-Json)
$labRoot = Join-Path ([IO.Path]::GetTempPath()) ('soterai-security-review-' + [Guid]::NewGuid().ToString('N'))
$workspace = Join-Path $labRoot 'workspace'
$profile = Join-Path $labRoot 'profile'
$installed = Join-Path $labRoot 'extensions'
$evidence = Join-Path $runRoot 'live-host.json'
if (Test-Path -LiteralPath $evidence) { throw 'Evidence exists; refusing overwrite.' }
foreach ($directory in @($workspace,$profile,$installed,(Join-Path $profile 'User'))) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
[IO.File]::WriteAllText((Join-Path $workspace '.synthetic-review-lab'), 'synthetic-only-v1')
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$settings = @{ 'telemetry.telemetryLevel'='off'; 'update.mode'='none'; 'extensions.autoUpdate'=$false; 'extensions.autoCheckUpdates'=$false; 'soterai.cloud.enabled'=$false; 'soterai.privacyMode'='local'; 'soterai.autoVaultMigration.enabled'=$false; 'soterai.broker.port'=$port; 'soterai.broker.openAIProviderUrl'=''; 'soterai.broker.anthropicProviderUrl'='' }
[IO.File]::WriteAllText((Join-Path $profile 'User/settings.json'), ($settings | ConvertTo-Json))
if (!(Test-Path -LiteralPath $CodePath) -or !(Test-Path -LiteralPath $bundle)) { throw 'Build the security host bundle and choose an existing Code.exe.' }
$arguments = @("--extensionDevelopmentPath=$extensionRoot", "--extensionTestsPath=$bundle", "--user-data-dir=$profile", "--extensions-dir=$installed", '--disable-extensions', '--disable-workspace-trust', '--disable-gpu', '--disable-updates', '--skip-welcome', '--skip-release-notes', $workspace)
$startInfo = New-Object Diagnostics.ProcessStartInfo
$startInfo.FileName = [IO.Path]::GetFullPath($CodePath)
$startInfo.Arguments = (($arguments | ForEach-Object { if ($_ -match '"') { throw 'Invalid argument.' }; '"' + $_ + '"' }) -join ' ')
$startInfo.WorkingDirectory = $workspace
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.EnvironmentVariables.Clear()
foreach ($name in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')) { $value = [Environment]::GetEnvironmentVariable($name); if ($value) { $startInfo.EnvironmentVariables[$name] = $value } }
$startInfo.EnvironmentVariables['USERPROFILE'] = $profile
$startInfo.EnvironmentVariables['APPDATA'] = Join-Path $profile 'AppData/Roaming'
$startInfo.EnvironmentVariables['LOCALAPPDATA'] = Join-Path $profile 'AppData/Local'
$startInfo.EnvironmentVariables['SOTERAI_REVIEW_WORKSPACE'] = $workspace
$startInfo.EnvironmentVariables['SOTERAI_REVIEW_EVIDENCE'] = $evidence
$startInfo.EnvironmentVariables['SOTERAI_REVIEW_UNIQUE_EVIDENCE'] = '1'
$startInfo.EnvironmentVariables['SOTERAI_REVIEW_RUN_ID'] = $runId
$osIdentity = Get-ItemProperty -LiteralPath 'HKLM:/SOFTWARE/Microsoft/Windows NT/CurrentVersion'
$startInfo.EnvironmentVariables['SOTERAI_REVIEW_OS_BUILD'] = $osIdentity.CurrentBuild + '.' + $osIdentity.UBR
$gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
if ($gitCommand) { $startInfo.EnvironmentVariables['SOTERAI_REVIEW_GIT'] = $gitCommand.Source }
$process = New-Object Diagnostics.Process
$process.StartInfo = $startInfo
try {
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $timedOut=!$process.WaitForExit(60000)
    # Timeout is INCOMPLETE; preserve every Code.exe process, including this isolated host.
    [void]$process.WaitForExit(5000)
    $stdoutText = if($stdout.IsCompleted){$stdout.GetAwaiter().GetResult()}else{'INCOMPLETE: stdout drain did not finish.'}
    $stderrText = if($stderr.IsCompleted){$stderr.GetAwaiter().GetResult()}else{'INCOMPLETE: stderr drain did not finish.'}
    Write-NewText (Join-Path $runRoot 'stdout.txt') $stdoutText
    Write-NewText (Join-Path $runRoot 'stderr.txt') $stderrText
    $stdoutText
    $stderrText
    Write-Output ('Per-run evidence at ' + $runRoot)
    Write-Output ('Synthetic lab retained at ' + $labRoot)
    if ($timedOut) { throw 'Isolated host timed out; raw output retained; no security pass is recorded.' }
    if (!$process.HasExited) { throw 'Host exit/drain INCOMPLETE; raw output retained.' }
    $hostExitCode=$process.ExitCode
} finally { $process.Dispose() }
exit $hostExitCode
