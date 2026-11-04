param([Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingSha256)
# Root-only launch candidate. Importing/preparing this file launches nothing.
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if([IO.Path]::GetFullPath($BindingPath) -cne (Join-Path $PSScriptRoot 'f05-current-binding-03.json') -or (Get-FileHash -LiteralPath $BindingPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedBindingSha256){throw 'Exact current F05 binding required.'}
$taskAnswer=& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'run-f05-current-proposed-03.cjs') --emit-binding
if($LASTEXITCODE -ne 0){throw 'Current F05 admission refused.'}
$taskBinding=$taskAnswer|ConvertFrom-Json
. (Join-Path $PSScriptRoot 'affected-preparation-pipe-ownership-01.ps1')
function Write-F05NewBytes([string]$File,[byte[]]$Bytes){$taskFd=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$taskFd.Write($Bytes,0,$Bytes.Length);$taskFd.Flush($true)}finally{$taskFd.Dispose()}}
function Write-F05NewJson([string]$File,[object]$Value){Write-F05NewBytes $File ([Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 80)+[Environment]::NewLine))}
function Assert-F05Fact($Fact,[string]$Override){$taskFile=if($Override){$Override}elseif([IO.Path]::IsPathRooted($Fact.path)){$Fact.path}else{Join-Path $taskRepo $Fact.path};$taskItem=Get-Item -LiteralPath $taskFile -Force;if($taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $taskItem.Length -ne $Fact.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Fact.sha256){throw 'F05 pinned input differs.'}}
$taskName='f05-current-native-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRun=Join-Path $PSScriptRoot $taskName;$taskExecution=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskExecution.StartsWith('D:\SoterAI-Lite-test-profiles\f05-current-native-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRun) -or (Test-Path -LiteralPath $taskExecution)){throw 'Fresh isolated F05 root required.'}
$taskSnapshot=Join-Path $taskExecution 'extension';$taskProfile=Join-Path $taskExecution 'profile';$taskWorkspace=Join-Path $taskExecution 'workspace';$taskInstalled=Join-Path $taskExecution 'extensions'
foreach($taskDir in @($taskRun,$taskSnapshot,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDir)}
$taskSource=Join-Path $taskRepo $taskBinding.extractedRoot
foreach($taskEntry in Get-ChildItem -LiteralPath $taskSource -Force){if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked artifact input refused.'};Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskSnapshot -Recurse}
function Assert-F05Runtimes {
 Assert-F05Fact $taskBinding.vsix '';Assert-F05Fact $taskBinding.code ''
 if(([Diagnostics.FileVersionInfo]::GetVersionInfo($taskBinding.code.path)).ProductVersion -cne '1.145.0'){throw 'Exact Code1.145.0 required.'}
 foreach($taskFact in $taskBinding.vendorJsonPins){Assert-F05Fact $taskFact ''}
 foreach($taskFact in $taskBinding.runtimes){Assert-F05Fact $taskFact (Join-Path $taskSnapshot ('dist/'+[IO.Path]::GetFileName($taskFact.path)))}
}
Assert-F05Runtimes
$taskManifestPath=Join-Path $taskSnapshot 'package.json';$taskOriginalManifest=[IO.File]::ReadAllBytes($taskManifestPath)
Write-F05NewBytes (Join-Path $taskRun 'original-manifest.json') $taskOriginalManifest
$taskManifest=[Text.UTF8Encoding]::new($false,$true).GetString($taskOriginalManifest)|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard' -or $taskManifest.main -cne './dist/extension.js'){throw 'Exact product manifest identity required.'}
$taskManifest.main='./dist-test/native-bootstrap.cjs';[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskTestFile=Join-Path $taskSnapshot 'dist-test/host/index.js';[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskTestFile));[IO.File]::Copy((Join-Path $taskRepo $taskBinding.driver.path),$taskTestFile,$false);Assert-F05Fact $taskBinding.driver $taskTestFile
$taskBootstrap=@'
const vscode=require('vscode'),fs=require('node:fs/promises'),actual=require('../dist/extension.js'),driver=require('./host/index.js');
const failure=async(stage,error)=>fs.writeFile(process.env.SOTERAI_LITE_F05_EVIDENCE+'.driver-error.json',JSON.stringify({status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure'})+'\n',{flag:'wx'});
exports.activate=async function(context){let stage='beforeActivate';try{await driver.beforeActivate(context);stage='activate';await actual.activate(context);}catch(error){try{await failure(stage,error);}finally{await vscode.commands.executeCommand('workbench.action.closeWindow');}return;}setTimeout(async()=>{try{await driver.run(context);}catch(error){await failure('run',error);}finally{await vscode.commands.executeCommand('workbench.action.closeWindow');}},1500);};
exports.deactivate=actual.deactivate;
'@
Write-F05NewBytes (Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs') ([Text.UTF8Encoding]::new($false).GetBytes($taskBootstrap))
Write-F05NewBytes (Join-Path $taskWorkspace '.synthetic-lite-f05-host') ([Text.UTF8Encoding]::new($false).GetBytes('synthetic-only-v1'))
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;'json.schemaDownload.enable'=$false;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;'soterai.projectPrivacy.enabled'=$true;'soterai.projectPrivacy.atomicSensitivePolicy'=$true;'soterai.projectPrivacy.safeViewComposition'=$true;'soterai.hardening.addOnlyPolicy'=$true;'soterai.lite.restrictionSave'=$true}
Write-F05NewJson (Join-Path $taskProfile 'User/settings.json') $taskSettings
Write-F05NewJson (Join-Path $taskRun 'freeze.json') @{status='F05_DEVELOPER_BOOTSTRAP_CURRENT10_NOT_CLEAN_INSTALL';bindingSha256=$ExpectedBindingSha256;executionRoot=$taskExecution;code=$taskBinding.code;codeVersion=$taskBinding.codeVersion;vendorJsonRoot=$taskBinding.vendorJsonRoot;vendorJsonPins=$taskBinding.vendorJsonPins;vsix=$taskBinding.vsix;sourceProof=$taskBinding.sourceProof;qualification=$taskBinding.qualification;runtimes=$taskBinding.runtimes;driver=$taskBinding.driver;originalManifestSha256=(Get-FileHash -LiteralPath (Join-Path $taskRun 'original-manifest.json')).Hash.ToLowerInvariant();fixtureManifestSha256=(Get-FileHash -LiteralPath $taskManifestPath).Hash.ToLowerInvariant();bootstrapSha256=(Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs')).Hash.ToLowerInvariant();signalsRequested=0;independence='LOW_SCRIPTED_NATIVE'}
$taskPhases=@()
foreach($taskPhase in @('save','reload')){
 Assert-F05Runtimes;Assert-F05Fact $taskBinding.driver $taskTestFile
 $taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskBinding.code.path
 $taskArgs=@('--new-window',"--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",'--disable-extensions','--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm','--disable-extension=vscode.extension-editing','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'}) -join ' ')
 $taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
 $taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskResult=Join-Path $taskExecution ($taskPhase+'-results.json');$taskInfo.EnvironmentVariables['SOTERAI_LITE_F05_PHASE']=$taskPhase;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F05_PROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F05_EVIDENCE']=$taskResult;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F05_BUNDLE_SHA256']=$taskBinding.frontendSha256;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F05_DRIVER_KIND']='native-bootstrap'
 $taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo;$taskOut=$null;$taskErr=$null;$taskTimeout=$false
 try{
  [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.ElapsedMilliseconds -lt $taskBinding.deadlineMillisecondsPerCode){}
  $taskTimeout=-not $taskProcess.HasExited
 }finally{Complete-F26AOwnedProcess -OwnedProcess $taskProcess -StdoutTask $taskOut -StderrTask $taskErr -RecordPath (Join-Path $taskRun ($taskPhase+'-helper-pipe-ownership'))}
 Write-F05NewBytes (Join-Path $taskRun ($taskPhase+'-stdout.txt')) ([Text.UTF8Encoding]::new($false).GetBytes($taskOut.GetAwaiter().GetResult()));Write-F05NewBytes (Join-Path $taskRun ($taskPhase+'-stderr.txt')) ([Text.UTF8Encoding]::new($false).GetBytes($taskErr.GetAwaiter().GetResult()))
 foreach($taskSuffix in @('','.driver-error.json')){if(Test-Path -LiteralPath ($taskResult+$taskSuffix)){[IO.File]::Copy(($taskResult+$taskSuffix),(Join-Path $taskRun ($taskPhase+'-results.json'+$taskSuffix)),$false)}}
 $taskClose=Get-Content -Raw -LiteralPath (Join-Path $taskRun ($taskPhase+'-helper-pipe-ownership.json'))|ConvertFrom-Json
 if($taskTimeout -or $taskClose.exitCode -ne 0 -or -not $taskClose.observedExit -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF -or -not(Test-Path -LiteralPath $taskResult)){throw 'F05 native phase failed/incomplete; no automatic retry.'}
 $taskObserved=Get-Content -Raw -LiteralPath $taskResult|ConvertFrom-Json;$taskCount=if($taskPhase -ceq 'save'){7}else{3}
 if($taskObserved.phase -cne $taskPhase -or $taskObserved.passed -ne $taskCount -or @($taskObserved.observations).Count -ne $taskCount -or $taskObserved.failed -ne 0 -or $taskObserved.notRun -ne 0 -or $taskObserved.driverFailure -or (Test-Path -LiteralPath ($taskResult+'.driver-error.json')) -or $taskObserved.extensionBundleSha256 -cne $taskBinding.frontendSha256){throw 'Original F05 assertions failed or missing.'}
 Assert-F05Runtimes;Assert-F05Fact $taskBinding.driver $taskTestFile
 $taskPhases+=@{phase=$taskPhase;checks=$taskCount;result=(Join-Path $taskRun ($taskPhase+'-results.json'));sha256=(Get-FileHash -LiteralPath $taskResult).Hash.ToLowerInvariant();close=(Join-Path $taskRun ($taskPhase+'-helper-pipe-ownership.json'))}
}
Write-F05NewJson (Join-Path $taskRun 'summary.json') @{status='PASS_CURRENT_F05_CUSTOMDOCUMENT10_DEVELOPER_BOOTSTRAP_ONLY';nativeChecks=10;phases=$taskPhases;bindingSha256=$ExpectedBindingSha256;vsix=$taskBinding.vsix;sourceProof=$taskBinding.sourceProof;codeVersion='1.145.0';signalsRequested=0;independence='LOW_SCRIPTED_NATIVE';installedOnlyProof='NOT_PROVIDED';allDescendantEOF='NOT_INFERRED'}
Write-Output ('F05 native10 evidence: '+$taskRun)
