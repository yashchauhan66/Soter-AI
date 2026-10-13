param(
    [Parameter(Mandatory=$true)][string]$CodePath,
    [Parameter(Mandatory=$true)][string]$HostTestsPath,
    [Parameter(Mandatory=$true)][string]$OutputRoot
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$extensionRoot = Join-Path $repoRoot 'packages/vscode-extension'
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
if (-not $OutputRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output must stay inside the workspace.' }
foreach ($inputPath in @($CodePath,$HostTestsPath,(Join-Path $extensionRoot 'dist/extension.js'))) {
    if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) { throw 'Required pre-built input is missing.' }
}
$runId = 'privacy-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$runRoot = Join-Path $OutputRoot $runId
if (Test-Path -LiteralPath $runRoot) { throw 'Existing evidence output refused.' }
$snapshot = Join-Path $runRoot 'extension'
$profile = Join-Path $runRoot 'profile'
$workspace = Join-Path $runRoot 'workspace'
$installed = Join-Path $runRoot 'extensions'
$publicParent = Join-Path $runRoot 'public-output'
foreach ($directory in @($snapshot,(Join-Path $snapshot 'dist'),(Join-Path $snapshot 'media'),(Join-Path $profile 'User'),$workspace,$installed,$publicParent)) {
    [void][IO.Directory]::CreateDirectory($directory)
}
Copy-Item -LiteralPath (Join-Path $extensionRoot 'package.json') -Destination $snapshot
foreach ($name in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')) {
    Copy-Item -LiteralPath (Join-Path $extensionRoot ('dist/' + $name)) -Destination (Join-Path $snapshot 'dist')
}
foreach ($name in @('icon.svg','logo_circle_whiter.png')) {
    Copy-Item -LiteralPath (Join-Path $extensionRoot ('media/' + $name)) -Destination (Join-Path $snapshot 'media')
}
if (Test-Path -LiteralPath (Join-Path $extensionRoot 'verification/project-privacy-verification.json')) {
    [void][IO.Directory]::CreateDirectory((Join-Path $snapshot 'verification'))
    Copy-Item -LiteralPath (Join-Path $extensionRoot 'verification/project-privacy-verification.json') -Destination (Join-Path $snapshot 'verification')
}
$tests = Join-Path $snapshot 'dist-test/host/index.js'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $tests))
Copy-Item -LiteralPath $HostTestsPath -Destination $tests
[IO.File]::WriteAllText((Join-Path $workspace '.synthetic-privacy-host'),'synthetic-only-v1')
$settings = @{ 'telemetry.telemetryLevel'='off'; 'update.mode'='none'; 'extensions.autoUpdate'=$false;
    'extensions.autoCheckUpdates'=$false; 'soterai.cloud.enabled'=$false; 'soterai.privacyMode'='local';
    'soterai.autoVaultMigration.enabled'=$false; 'soterai.broker.autoStart'=$false;
    'soterai.projectPrivacy.enabled'=$true; 'soterai.projectPrivacy.atomicSensitivePolicy'=$true;
    'soterai.projectPrivacy.safeViewComposition'=$true; 'soterai.projectPrivacy.professionalUi'=$true;
    'soterai.projectPrivacy.safePublication'=$false; 'soterai.projectPrivacy.syntheticRuntime'=$false }
[IO.File]::WriteAllText((Join-Path $profile 'User/settings.json'),($settings | ConvertTo-Json))
$bundleHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $snapshot 'dist/extension.js')).Hash.ToLowerInvariant()
$freeze = @{ runId=$runId; createdAt=[DateTime]::UtcNow.ToString('o'); syntheticOnly=$true;
    extensionBundleSha256=$bundleHash; hostTestsSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $tests).Hash.ToLowerInvariant();
    codeSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $CodePath).Hash.ToLowerInvariant();
    extensionPath=$snapshot; profile=$profile; workspace=$workspace;
    limitations='Functional commands and actual webview; scripted modal responses; no Cline live or OS isolation claim.' }
[IO.File]::WriteAllText((Join-Path $runRoot 'freeze.json'),($freeze | ConvertTo-Json))
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = [IO.Path]::GetFullPath($CodePath)
$arguments = @("--extensionDevelopmentPath=$snapshot", "--extensionTestsPath=$tests", "--user-data-dir=$profile",
    "--extensions-dir=$installed", '--disable-extensions', '--disable-workspace-trust', '--disable-gpu',
    '--disable-updates', '--skip-welcome', '--skip-release-notes', $workspace)
$info.Arguments = (($arguments | ForEach-Object { if ($_ -match '"') { throw 'Invalid launch argument.' }; '"' + $_ + '"' }) -join ' ')
$info.WorkingDirectory = $workspace
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.EnvironmentVariables.Clear()
foreach ($name in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { $info.EnvironmentVariables[$name]=$value }
}
$info.EnvironmentVariables['USERPROFILE']=$profile
$info.EnvironmentVariables['APPDATA']=Join-Path $profile 'AppData/Roaming'
$info.EnvironmentVariables['LOCALAPPDATA']=Join-Path $profile 'AppData/Local'
$info.EnvironmentVariables['SOTERAI_HOST_PROJECT_PRIVACY']='1'
$info.EnvironmentVariables['SOTERAI_PRIVACY_HOST_EVIDENCE']=Join-Path $runRoot 'functional-results.json'
$info.EnvironmentVariables['SOTERAI_PRIVACY_BUNDLE_SHA256']=$bundleHash
$info.EnvironmentVariables['SOTERAI_PRIVACY_PUBLIC_PARENT']=$publicParent
$process = New-Object Diagnostics.Process
$process.StartInfo=$info
try {
    [void]$process.Start()
    $stdout=$process.StandardOutput.ReadToEndAsync()
    $stderr=$process.StandardError.ReadToEndAsync()
    $elapsed=[Diagnostics.Stopwatch]::StartNew()
    while (-not $process.WaitForExit(1000) -and $elapsed.Elapsed.TotalSeconds -lt 120) { }
    $timedOut=-not $process.HasExited
    $stdoutText=if($stdout.IsCompleted){$stdout.GetAwaiter().GetResult()}else{'INCOMPLETE: stdout drain pending.'}
    $stderrText=if($stderr.IsCompleted){$stderr.GetAwaiter().GetResult()}else{'INCOMPLETE: stderr drain pending.'}
    [IO.File]::WriteAllText((Join-Path $runRoot 'stdout.txt'),$stdoutText)
    [IO.File]::WriteAllText((Join-Path $runRoot 'stderr.txt'),$stderrText)
    $stdoutText
    $stderrText
    Write-Output ('Functional evidence: ' + $runRoot)
    if ($timedOut) { throw 'INCOMPLETE: functional host timeout; every Code.exe process retained.' }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $snapshot 'dist/extension.js')).Hash.ToLowerInvariant() -ne $bundleHash) { throw 'Frozen bundle changed.' }
    $hostExit=$process.ExitCode
} finally { $process.Dispose() }
exit $hostExit
