param([Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot)
$ErrorActionPreference='Stop'
$taskRepoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskExtension=[IO.Path]::GetFullPath($ExtensionRoot)
if (-not $taskExtension.StartsWith($taskRepoRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Extension must stay in workspace.' }
$taskRunRoot=Join-Path $PSScriptRoot ('host-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
if (Test-Path -LiteralPath $taskRunRoot) { throw 'Evidence overwrite refused.' }
$taskProfile=Join-Path $taskRunRoot 'profile'
$taskWorkspace=Join-Path $taskRunRoot 'workspace'
$taskInstalled=Join-Path $taskRunRoot 'extensions'
$taskSnapshot=Join-Path $taskRunRoot 'extension'
foreach($taskDirectory in @((Join-Path $taskProfile 'User'),$taskWorkspace,$taskInstalled,$taskSnapshot)) { [void][IO.Directory]::CreateDirectory($taskDirectory) }
foreach($taskSourceEntry in Get-ChildItem -LiteralPath $taskExtension -Force) {
 Copy-Item -LiteralPath $taskSourceEntry.FullName -Destination $taskSnapshot -Recurse
}
$taskCopiedHost=Join-Path $taskSnapshot 'dist-test/host/index.js'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskCopiedHost))
Copy-Item -LiteralPath $HostTestsPath -Destination $taskCopiedHost
# VS Code's API instance is resolved by the caller's extension directory. Keep
# the synthetic UI driver inside the same isolated extension snapshot.
$taskExtension=$taskSnapshot
$HostTestsPath=$taskCopiedHost
[IO.File]::WriteAllText((Join-Path $taskWorkspace '.synthetic-lite-f01-host'),'synthetic-only-v1')
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;
 'extensions.autoCheckUpdates'=$false;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';
 'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
 'soterai.projectPrivacy.enabled'=$true;'soterai.projectPrivacy.atomicSensitivePolicy'=$true;
 'soterai.projectPrivacy.safeViewComposition'=$true;'soterai.hardening.addOnlyPolicy'=$true;
 'soterai.lite.restrictionSave'=$true}
[IO.File]::WriteAllText((Join-Path $taskProfile 'User/settings.json'),($taskSettings|ConvertTo-Json))
$taskBundleHash=(Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js')).Hash.ToLowerInvariant()
$taskFreeze=@{createdAt=[DateTime]::UtcNow.ToString('o');extensionRoot=$taskExtension;extensionBundleSha256=$taskBundleHash;
 hostTestsSha256=(Get-FileHash -LiteralPath $HostTestsPath).Hash.ToLowerInvariant();codeSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant();
 workspace=$taskWorkspace;profile=$taskProfile;syntheticOnly=$true;limitation='Scripted command/dialog tests; no third-party assistant or independent owner presence.'}
$taskFreeze|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $taskRunRoot 'freeze.json') -Encoding utf8 -NoClobber
foreach($taskPhase in @('save','reload')) {
 $taskInfo=New-Object Diagnostics.ProcessStartInfo
 $taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
 $taskArgs=@("--extensionDevelopmentPath=$taskExtension","--extensionTestsPath=$([IO.Path]::GetFullPath($HostTestsPath))",
  "--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",'--disable-extensions','--disable-workspace-trust',
  '--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object {if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'}) -join ' ')
 $taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true
 $taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
 $taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true
 $taskInfo.EnvironmentVariables.Clear()
 foreach($taskName in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')) {
  $taskValue=[Environment]::GetEnvironmentVariable($taskName)
  if($taskValue){$taskInfo.EnvironmentVariables[$taskName]=$taskValue}
 }
 $taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile
 $taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming'
 $taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F01_PHASE']=$taskPhase
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F01_PROFILE']=$taskProfile
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F01_EVIDENCE']=Join-Path $taskRunRoot ($taskPhase+'-results.json')
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F01_BUNDLE_SHA256']=$taskBundleHash
 $taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo
 try {
  [void]$taskProcess.Start()
  $taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
  $taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 120){}
  $taskTimeout=-not $taskProcess.HasExited
  $taskOutText=if($taskStdout.IsCompleted){$taskStdout.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
  $taskErrText=if($taskStderr.IsCompleted){$taskStderr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
  $taskOutText|Out-File -LiteralPath (Join-Path $taskRunRoot ($taskPhase+'-stdout.txt')) -Encoding utf8 -NoClobber
  $taskErrText|Out-File -LiteralPath (Join-Path $taskRunRoot ($taskPhase+'-stderr.txt')) -Encoding utf8 -NoClobber
  if($taskTimeout){throw 'INCOMPLETE: isolated host timeout; processes retained.'}
  if($taskProcess.ExitCode -ne 0){throw ('Host phase failed: '+$taskPhase)}
  if((Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js')).Hash.ToLowerInvariant() -ne $taskBundleHash){throw 'Loaded bundle changed.'}
  Write-Output ('Host phase completed: '+$taskPhase)
 } finally {$taskProcess.Dispose()}
}
Write-Output ('Evidence: '+$taskRunRoot)
