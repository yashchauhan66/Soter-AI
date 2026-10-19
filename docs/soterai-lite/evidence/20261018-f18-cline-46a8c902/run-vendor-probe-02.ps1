$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskVendor='C:\Users\USER\.vscode\extensions\saoudrizwan.claude-dev-4.1.25'
$taskExpected='a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022'
if((Get-FileHash -LiteralPath (Join-Path $taskVendor 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'Pinned Cline source changed'}
$taskName='f18-vendor-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f18-vendor-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Unexpected or existing synthetic profile root'}
$taskEvidence=Join-Path $PSScriptRoot $taskName
$taskExtension=Join-Path $taskRoot 'extension';$taskProfile=Join-Path $taskRoot 'profile';$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskDirectory in @($taskEvidence,$taskExtension,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,(Join-Path $taskRoot 'extensions'))){[void][IO.Directory]::CreateDirectory($taskDirectory)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskVendor -Force){if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked vendor artifact refused'}; Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskExtension -Recurse}
if((Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'Copied Cline runtime mismatch'}
$taskManifestPath=Join-Path $taskExtension 'package.json';$taskManifest=Get-Content -LiteralPath $taskManifestPath -Raw|ConvertFrom-Json
$taskManifest.main='./soterai-f18-bootstrap.cjs'
[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'native-vendor-probe-02.cjs') -Destination (Join-Path $taskExtension 'soterai-f18-bootstrap.cjs')
$taskSettings=@{'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'cline.telemetrySetting'='disabled'}
[IO.File]::WriteAllText((Join-Path $taskProfile 'User/settings.json'),($taskSettings|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
$taskResult=Join-Path $taskRoot 'vendor-result.json'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode;$taskInfo.Arguments='--new-window --disable-updates --skip-welcome --skip-release-notes --disable-workspace-trust --user-data-dir "'+$taskProfile+'" --extensions-dir "'+(Join-Path $taskRoot 'extensions')+'" --extensionDevelopmentPath="'+$taskExtension+'" "'+$taskWorkspace+'"'
$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['DO_NOT_TRACK']='1';$taskInfo.EnvironmentVariables['DISABLE_TELEMETRY']='1';$taskInfo.EnvironmentVariables['SOTERAI_F18_PROBE_ROOT']=$taskRoot;$taskInfo.EnvironmentVariables['SOTERAI_F18_PROBE_RESULT']=$taskResult
$taskFreeze=@{status='FROZEN_ACTUAL_VENDOR_PROBE_NOT_PRODUCT_ACCEPTANCE';installedVendor=$taskVendor;sourceSha256=$taskExpected;copiedRuntime=(Join-Path $taskExtension 'dist/extension.js');profile=$taskProfile;workspace=$taskWorkspace;code=$taskCode;codeSha256=(Get-FileHash -LiteralPath $taskCode -Algorithm SHA256).Hash.ToLowerInvariant();probeSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-vendor-probe-02.cjs') -Algorithm SHA256).Hash.ToLowerInvariant();processSignalsAllowed=$false;normalProfileReadAllowed=$false;nonLoopbackAllowed=$false;independence='LOW'}
[IO.File]::WriteAllText((Join-Path $taskEvidence 'freeze.json'),($taskFreeze|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync()
 $taskFinished=$taskProcess.WaitForExit(180000)
 if(-not $taskFinished){throw 'INCOMPLETE: vendor window did not close naturally; retained, no process kill'}
 [IO.File]::WriteAllText((Join-Path $taskEvidence 'stdout.txt'),$taskStdout.GetAwaiter().GetResult(),[Text.UTF8Encoding]::new($false));[IO.File]::WriteAllText((Join-Path $taskEvidence 'stderr.txt'),$taskStderr.GetAwaiter().GetResult(),[Text.UTF8Encoding]::new($false))
 if(Test-Path -LiteralPath $taskResult){Copy-Item -LiteralPath $taskResult -Destination (Join-Path $taskEvidence 'vendor-result.json')}else{throw 'INCOMPLETE: actual vendor result missing'}
 if((Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'Copied runtime changed during execution'}
 Get-Content -LiteralPath (Join-Path $taskEvidence 'vendor-result.json') -Raw
}finally{$taskProcess.Dispose()}
