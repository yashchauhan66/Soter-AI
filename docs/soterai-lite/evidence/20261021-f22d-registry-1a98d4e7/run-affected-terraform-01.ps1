param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot)
$taskHost=[IO.Path]::GetFullPath($HostTestsPath)
$taskVsix=[IO.Path]::GetFullPath($VsixPath)
foreach($taskInput in @($taskSource,$taskHost,$taskVsix)){
 if(-not $taskInput.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture input outside workspace.'}
}
foreach($taskInput in @($CodePath,$taskHost,$taskVsix,(Join-Path $taskSource 'dist/extension.js'),(Join-Path $taskSource 'package.json'))){
 if(-not(Test-Path -LiteralPath $taskInput -PathType Leaf)){throw 'Required reviewed runtime/host/executable input missing.'}
}
$taskExpected=$ExpectedBundleSha256.ToLowerInvariant()
$taskExpectedVsix=$ExpectedVsixSha256.ToLowerInvariant()
if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpectedVsix){throw 'Exact new VSIX identity mismatch.'}
if((Get-FileHash -LiteralPath (Join-Path $taskSource 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected){throw 'Extracted runtime identity mismatch.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
try{
 foreach($taskEntryName in @('extension/dist/extension.js','extension/package.json')){
  $taskEntries=@($taskZip.Entries|Where-Object{$_.FullName -ceq $taskEntryName})
  if($taskEntries.Count -ne 1){throw 'Archive entry absent or duplicated.'}
  $taskStream=$taskEntries[0].Open()
  $taskDigest=[Security.Cryptography.SHA256]::Create()
  try{$taskArchiveHash=([BitConverter]::ToString($taskDigest.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskDigest.Dispose();$taskStream.Dispose()}
  $taskRelative=$taskEntryName.Substring('extension/'.Length).Replace('/',[IO.Path]::DirectorySeparatorChar)
  if((Get-FileHash -LiteralPath (Join-Path $taskSource $taskRelative) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskArchiveHash){throw 'Extracted runtime/manifest differs from the exact new VSIX entry.'}
 }
}finally{$taskZip.Dispose()}
$taskName='f22d-affected-terraform-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRun=Join-Path $PSScriptRoot $taskName
$taskExecution=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskExecution.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected execution root.'}
if((Test-Path -LiteralPath $taskRun) -or (Test-Path -LiteralPath $taskExecution)){throw 'Existing evidence/profile refused.'}
$taskProfile=Join-Path $taskExecution 'profile'
$taskWorkspace=Join-Path $taskExecution 'workspace'
$taskInstalled=Join-Path $taskExecution 'extensions'
$taskSnapshot=Join-Path $taskExecution 'extension'
foreach($taskDir in @($taskRun,$taskSnapshot,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDir)}
function Write-F17NewJson([string]$Path,[object]$Value){
 $taskJson=($Value|ConvertTo-Json -Depth 24)+[Environment]::NewLine
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($taskJson)
 $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
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
const failure = async (stage,error) => fs.writeFile(process.env.SOTERAI_LITE_F17_EVIDENCE+'.driver-error.json',
 JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure',setup:typeof driver.setupDiagnostic==='function'?driver.setupDiagnostic():undefined})+'\n',{flag:'wx'});
exports.activate = async function(context) {
 try { if (typeof driver.beforeActivate === 'function') await driver.beforeActivate(context); await actual.activate(context); }
 catch(error) { try { await failure('activate',error); } finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); } return; }
 setTimeout(async()=>{try { await driver.run(context); } catch(error) { await failure('run',error); }
 finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }},1500);
};
exports.deactivate = actual.deactivate;
'@
[IO.File]::WriteAllText((Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs'),$taskBootstrap,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskWorkspace '.synthetic-lite-f16-host'),'synthetic-only-v1')
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;
 'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';
 'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;
 'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
 'soterai.hardening.secretInventory'=$true;'soterai.hardening.capabilityReleaseGuard'=$true;'soterai.lite.outputRedactor'=$true;
 'soterai.lite.secretMatching'=$true;'soterai.lite.vaultMode'=$true;'soterai.lite.vaultRuntime'=$true;'soterai.lite.ps51Terminal'=$true}
Write-F17NewJson (Join-Path $taskProfile 'User/settings.json') $taskSettings
$taskRuntimeBindings=@()
$taskRuntimeZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
try{
 foreach($taskRuntimeName in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')){
  $taskRuntimeEntries=@($taskRuntimeZip.Entries|Where-Object{$_.FullName -ceq ('extension/dist/'+$taskRuntimeName)})
  if($taskRuntimeEntries.Count -ne 1){throw 'Exact archive runtime entry required.'}
  $taskStream=$taskRuntimeEntries[0].Open();$taskDigest=[Security.Cryptography.SHA256]::Create()
  try{$taskDigestText=([BitConverter]::ToString($taskDigest.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskDigest.Dispose();$taskStream.Dispose()}
  $taskRuntimeBindings+=@{name=$taskRuntimeName;bytes=$taskRuntimeEntries[0].Length;sha256=$taskDigestText;source=(Join-Path $taskSource ('dist/'+$taskRuntimeName));execution=(Join-Path $taskSnapshot ('dist/'+$taskRuntimeName))}
 }
}finally{$taskRuntimeZip.Dispose()}
function Assert-F17NativeRuntimes {
 foreach($taskBinding in $taskRuntimeBindings){foreach($taskFile in @($taskBinding.source,$taskBinding.execution)){
  if((Get-Item -LiteralPath $taskFile).Length -ne $taskBinding.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBinding.sha256){throw 'Copied native runtime differs from exact VSIX.'}
 }}
}
Assert-F17NativeRuntimes
$taskRuntime=Join-Path $taskSnapshot 'dist/extension.js'
$taskHash=(Get-FileHash -LiteralPath $taskRuntime -Algorithm SHA256).Hash.ToLowerInvariant()
if($taskHash -ne $taskExpected){throw 'Copied runtime identity mismatch.'}
$taskCodeSha=(Get-FileHash -LiteralPath $CodePath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-F17NewJson (Join-Path $taskRun 'freeze.json') @{
 createdAt=[DateTime]::UtcNow.ToString('o');syntheticOnly=$true;phases=@('primary','restart');executionEvidenceRoot=$taskExecution;
 sourceExtension=$taskSource;executionExtension=$taskSnapshot;profile=$taskProfile;workspace=$taskWorkspace;
 exactVsix=$taskVsix;vsixSha256=$taskExpectedVsix;extensionBundleSha256=$taskExpected;runtimeBindings=$taskRuntimeBindings;
 codeExecutableSha256=$taskCodeSha;codeProductVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($CodePath)).ProductVersion;
 hostProbeSha256=(Get-FileHash -LiteralPath $taskProbe -Algorithm SHA256).Hash.ToLowerInvariant();
 sourceManifestSha256=(Get-FileHash -LiteralPath (Join-Path $taskRun 'original-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant();
 fixtureManifestSha256=(Get-FileHash -LiteralPath $taskManifestPath -Algorithm SHA256).Hash.ToLowerInvariant();
 bootstrapSha256=(Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs') -Algorithm SHA256).Hash.ToLowerInvariant();
 limitation='Exact unchanged VSIX runtime under developer bootstrap; registered native Terraform commands, real SecretStorage and saved synthetic IO. Scripted file/finding/modal decisions LOW; no human UX, live credential validity, provider rotation, OS custody or unmanaged-route certification.'
}
$taskResults=@()
foreach($taskPhase in @('primary','restart')){
 Assert-F17NativeRuntimes
 $taskInfo=New-Object Diagnostics.ProcessStartInfo
 $taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
 $taskArgs=@("--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",'--new-window',
  '--disable-extensions','--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication',
  '--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',
  '--disable-extension=vscode.extension-editing','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object {if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'}) -join ' ')
 $taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
 $taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskSystemName in @('SystemRoot','WINDIR','COMSPEC')){$taskSystemValue=[Environment]::GetEnvironmentVariable($taskSystemName);if($taskSystemValue){$taskInfo.EnvironmentVariables[$taskSystemName]=$taskSystemValue}}
 $taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
 $taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskResult=Join-Path $taskExecution ($taskPhase+'-results.json')
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_PROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_EVIDENCE']=$taskResult
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_PHASE']=$taskPhase;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_AMBIENT']='synthetic-ambient-control-must-not-inherit'
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_BUNDLE_SHA256']=$taskHash;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F17_DRIVER_KIND']='native-bootstrap'
 $taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo
 try{
  [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 180){}
  $taskTimeout=-not $taskProcess.HasExited
  $taskDrainTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskTimeout -and (-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted) -and $taskDrainTimer.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}
  Write-F17NewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-close.json')) @{observedExit=(-not $taskTimeout);exitCode=$(if($taskTimeout){$null}else{$taskProcess.ExitCode});stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;signalsRequested=0;ownedWindowClose='workbench.action.closeWindow'}
  $taskOutText=if($taskOut.IsCompleted){$taskOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
  $taskErrText=if($taskErr.IsCompleted){$taskErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
  $taskOutText|Out-File -LiteralPath (Join-Path $taskRun ($taskPhase+'-stdout.txt')) -Encoding utf8 -NoClobber
  $taskErrText|Out-File -LiteralPath (Join-Path $taskRun ($taskPhase+'-stderr.txt')) -Encoding utf8 -NoClobber
  if(Test-Path -LiteralPath ($taskResult+'.driver-error.json')){Copy-Item -LiteralPath ($taskResult+'.driver-error.json') -Destination (Join-Path $taskRun ($taskPhase+'-driver-error.json'))}
  if(Test-Path -LiteralPath $taskResult){Copy-Item -LiteralPath $taskResult -Destination (Join-Path $taskRun ($taskPhase+'-results.json'))}
  if($taskTimeout){throw 'INCOMPLETE: owned isolated window timed out; process retained.'}
  if(-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted){throw 'INCOMPLETE: owned editor EOF not observed; no signals requested.'}
  if($taskProcess.ExitCode -ne 0 -or -not(Test-Path -LiteralPath $taskResult)){throw 'Native result missing or host failed; preserve evidence.'}
  $taskObserved=Get-Content -LiteralPath $taskResult -Raw -Encoding UTF8|ConvertFrom-Json
  $taskCount=if($taskPhase -eq 'primary'){21}else{4}
  if($taskObserved.phase -ne $taskPhase -or $taskObserved.passed -ne $taskCount -or @($taskObserved.observations).Count -ne $taskCount -or $taskObserved.failed -ne 0 -or $taskObserved.notRun -ne 0 -or $taskObserved.driverFailure -or (Test-Path -LiteralPath ($taskResult+'.driver-error.json'))){throw 'Native assertions incomplete/failed; raw results retained.'}
  Assert-F17NativeRuntimes
  if((Get-FileHash -LiteralPath $taskRuntime -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash -or $taskObserved.extensionBundleSha256 -ne $taskHash){throw 'Runtime identity changed.'}
  if((Get-FileHash -LiteralPath $CodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskCodeSha){throw 'Editor executable changed.'}
  if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpectedVsix){throw 'Exact VSIX bytes changed.'}
  foreach($taskPeerName in @('peer-ready.json','peer-closed.json','peer-stop.json','restart-binding.json','f17-mcp-route-receipt.json')){ $taskPeerSource=if($taskPeerName -eq 'f17-mcp-route-receipt.json'){Join-Path $taskWorkspace $taskPeerName}else{Join-Path $taskExecution $taskPeerName}; $taskPeerCopy=Join-Path $taskRun $taskPeerName; if((Test-Path -LiteralPath $taskPeerSource) -and -not(Test-Path -LiteralPath $taskPeerCopy)){Copy-Item -LiteralPath $taskPeerSource -Destination $taskPeerCopy} }
  $taskResults+=@{phase=$taskPhase;passed=$taskCount;result=$taskResult;sha256=(Get-FileHash -LiteralPath $taskResult -Algorithm SHA256).Hash.ToLowerInvariant()}
 }finally{$taskProcess.Dispose()}
}
Write-F17NewJson (Join-Path $taskRun 'summary.json') @{status='PASS_SCOPED';nativeChecks=25;phases=$taskResults;extensionBundleSha256=$taskHash;vsixSha256=$taskExpectedVsix;independence='LOW';ownerPresence='SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW'}
Write-Output ('Native owned Terraform evidence: '+$taskRun)
