param([Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot)
$taskHost=[IO.Path]::GetFullPath($HostTestsPath)
foreach($taskInput in @($taskSource,$taskHost)){
 if(-not $taskInput.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture input outside workspace.'}
}
if(-not (Test-Path -LiteralPath (Join-Path $taskSource 'dist/extension.js')) -or -not (Test-Path -LiteralPath $taskHost)){throw 'Built fixture/runtime required.'}
$taskName='f08-native-host-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRun=Join-Path $PSScriptRoot $taskName
$taskExecution=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskExecution.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected execution root.'}
if((Test-Path -LiteralPath $taskRun) -or (Test-Path -LiteralPath $taskExecution)){throw 'Existing evidence/profile refused.'}
$taskProfile=Join-Path $taskExecution 'profile'
$taskWorkspace=Join-Path $taskExecution 'workspace'
$taskInstalled=Join-Path $taskExecution 'extensions'
$taskSnapshot=Join-Path $taskExecution 'extension'
foreach($taskDir in @($taskRun,$taskSnapshot,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDir)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskSource -Force){Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskSnapshot -Recurse}
$taskManifestPath=Join-Path $taskSnapshot 'package.json'
$taskOriginalManifest=[IO.File]::ReadAllText($taskManifestPath)
[IO.File]::WriteAllText((Join-Path $taskRun 'original-manifest.json'),$taskOriginalManifest,[Text.UTF8Encoding]::new($false))
$taskManifest=$taskOriginalManifest|ConvertFrom-Json
if($taskManifest.publisher -ne 'soterai' -or $taskManifest.name -ne 'soterai-ide-guard'){throw 'Unexpected packaged extension identity.'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskProbe=Join-Path $taskSnapshot 'dist-test/host/index.js'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskProbe))
Copy-Item -LiteralPath $taskHost -Destination $taskProbe
$taskBootstrap=@'
const vscode = require('vscode');
const fs = require('node:fs/promises');
const actual = require('../dist/extension.js');
const driver = require('./host/index.js');
const failure = async (stage,error) => fs.writeFile(process.env.SOTERAI_LITE_F08_EVIDENCE+'.driver-error.json',
 JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure'})+'\n',{flag:'wx'});
exports.activate = async function(context) {
 try { await actual.activate(context); }
 catch(error) { try { await failure('activate',error); } finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); } return; }
 setTimeout(async()=>{try { await driver.run(context); } catch(error) { await failure('run',error); }
 finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }},1500);
};
exports.deactivate = actual.deactivate;
'@
[IO.File]::WriteAllText((Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs'),$taskBootstrap,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskWorkspace '.synthetic-lite-f08-host'),'synthetic-only-v1')
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;
 'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';
 'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;
 'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
 'soterai.hardening.secretInventory'=$true;'soterai.hardening.capabilityReleaseGuard'=$true;'soterai.lite.outputRedactor'=$true}
[IO.File]::WriteAllText((Join-Path $taskProfile 'User/settings.json'),($taskSettings|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$taskRuntime=Join-Path $taskSnapshot 'dist/extension.js'
$taskHash=(Get-FileHash -LiteralPath $taskRuntime).Hash.ToLowerInvariant()
$taskFreeze=@{createdAt=[DateTime]::UtcNow.ToString('o');syntheticOnly=$true;phase='single';executionEvidenceRoot=$taskExecution;
 sourceExtension=$taskSource;executionExtension=$taskSnapshot;profile=$taskProfile;workspace=$taskWorkspace;
 codeExecutableSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant();codeProductVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($CodePath)).ProductVersion;
 extensionBundleSha256=$taskHash;hostProbeSha256=(Get-FileHash -LiteralPath $taskProbe).Hash.ToLowerInvariant();
 sourceManifestSha256=(Get-FileHash -LiteralPath (Join-Path $taskRun 'original-manifest.json')).Hash.ToLowerInvariant();
 fixtureManifestSha256=(Get-FileHash -LiteralPath $taskManifestPath).Hash.ToLowerInvariant();
 bootstrapSha256=(Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs')).Hash.ToLowerInvariant();
 limitation='Actual registered command in isolated native developer context delegates unchanged packaged runtime. Synthetic in-process transports, LOW independence; no network/external-agent/streaming/gateway/clean-install claim.'}
$taskFreeze|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $taskRun 'freeze.json') -Encoding utf8 -NoClobber
$taskInfo=New-Object Diagnostics.ProcessStartInfo
$taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
$taskArgs=@("--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",
 '--disable-extensions','--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication',
 '--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',
 '--disable-extension=vscode.extension-editing','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object {if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskSystemName in @('SystemRoot','WINDIR','COMSPEC')){$taskSystemValue=[Environment]::GetEnvironmentVariable($taskSystemName);if($taskSystemValue){$taskInfo.EnvironmentVariables[$taskSystemName]=$taskSystemValue}}
$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
$taskResult=Join-Path $taskExecution 'matching-results.json'
$taskInfo.EnvironmentVariables['SOTERAI_LITE_F08_PROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F08_EVIDENCE']=$taskResult
$taskInfo.EnvironmentVariables['SOTERAI_LITE_F08_BUNDLE_SHA256']=$taskHash;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F08_DRIVER_KIND']='native-bootstrap'
$taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo
try {
 [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 180){}
 $taskTimeout=-not $taskProcess.HasExited
 $taskOutText=if($taskOut.IsCompleted){$taskOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
 $taskErrText=if($taskErr.IsCompleted){$taskErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
 $taskOutText|Out-File -LiteralPath (Join-Path $taskRun 'stdout.txt') -Encoding utf8 -NoClobber
 $taskErrText|Out-File -LiteralPath (Join-Path $taskRun 'stderr.txt') -Encoding utf8 -NoClobber
 if($taskTimeout){throw 'INCOMPLETE: isolated native window timed out; process retained.'}
 if($taskProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $taskResult)){throw 'Native result missing or host failed.'}
 Copy-Item -LiteralPath $taskResult -Destination (Join-Path $taskRun 'matching-results.json')
 $taskResultHash=(Get-FileHash -LiteralPath $taskResult).Hash.ToLowerInvariant()
 [IO.File]::WriteAllText((Join-Path $taskRun 'result-copy.json'),(@{source=$taskResult;sha256=$taskResultHash}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 $taskObserved=Get-Content -LiteralPath $taskResult -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskObserved.failed -ne 0 -or $taskObserved.notRun -ne 0 -or $taskObserved.driverFailure -or (Test-Path -LiteralPath ($taskResult+'.driver-error.json'))){throw 'Native assertions incomplete or failed; preserve raw results.'}
 if((Get-FileHash -LiteralPath $taskRuntime).Hash.ToLowerInvariant() -ne $taskHash -or $taskObserved.extensionBundleSha256 -ne $taskHash){throw 'Runtime identity changed.'}
 Write-Output ('Native matching completed: '+$taskRun)
} finally {$taskProcess.Dispose()}
