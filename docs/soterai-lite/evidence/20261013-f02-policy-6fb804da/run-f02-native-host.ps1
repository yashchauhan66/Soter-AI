param([Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot)
$ErrorActionPreference='Stop'
$taskRepoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot)
if(-not $taskSource.StartsWith($taskRepoRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Source outside workspace.'}
$taskRun=Join-Path $PSScriptRoot ('native-host-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
if(Test-Path -LiteralPath $taskRun){throw 'Existing evidence refused.'}
$taskSnapshot=Join-Path $taskRun 'extension'
$taskProfile=Join-Path $taskRun 'profile'
$taskWorkspace=Join-Path $taskRun 'workspace'
$taskInstalled=Join-Path $taskRun 'extensions'
foreach($taskDir in @($taskSnapshot,(Join-Path $taskProfile 'User'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDir)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskSource -Force){Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskSnapshot -Recurse}
$taskManifestPath=Join-Path $taskSnapshot 'package.json'
$taskOriginalManifest=[IO.File]::ReadAllText($taskManifestPath)
[IO.File]::WriteAllText((Join-Path $taskRun 'original-manifest.json'),$taskOriginalManifest,[Text.UTF8Encoding]::new($false))
$taskManifest=$taskOriginalManifest|ConvertFrom-Json
$taskManifest.main='./dist-test/native-bootstrap.cjs'
[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskTestFile=Join-Path $taskSnapshot 'dist-test/host/index.js'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskTestFile))
Copy-Item -LiteralPath $HostTestsPath -Destination $taskTestFile
$taskBootstrap=@'
const vscode = require('vscode');
const fs = require('node:fs/promises');
const actual = require('../dist/extension.js');
exports.activate = function(context) {
  actual.activate(context);
  setTimeout(async () => {
    try { await require('./host/index.js').run(); }
    catch(error) {
      await fs.writeFile(process.env.SOTERAI_LITE_F02_EVIDENCE + '.driver-error.json',
        JSON.stringify({status:'FAIL',errorName:error instanceof Error ? error.name : 'UnknownFailure'})+'\n',{flag:'wx'});
    } finally { await vscode.commands.executeCommand('workbench.action.closeWindow'); }
  }, 1500);
};
exports.deactivate = actual.deactivate;
'@
[IO.File]::WriteAllText((Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs'),$taskBootstrap,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskWorkspace '.synthetic-lite-f02-host'),'synthetic-only-v1')
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;
 'extensions.autoCheckUpdates'=$false;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';
 'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
 'soterai.projectPrivacy.enabled'=$true;'soterai.projectPrivacy.atomicSensitivePolicy'=$true;
 'soterai.projectPrivacy.safeViewComposition'=$true;'soterai.hardening.addOnlyPolicy'=$true;'soterai.lite.restrictionSave'=$true}
[IO.File]::WriteAllText((Join-Path $taskProfile 'User/settings.json'),($taskSettings|ConvertTo-Json))
$taskHash=(Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist/extension.js')).Hash.ToLowerInvariant()
$taskFreeze=@{createdAt=[DateTime]::UtcNow.ToString('o');sourceExtension=$taskSource;executionExtension=$taskSnapshot;
 extensionBundleSha256=$taskHash;hostProbeSha256=(Get-FileHash -LiteralPath $taskTestFile).Hash.ToLowerInvariant();
 sourceManifestSha256=(Get-FileHash -LiteralPath (Join-Path $taskRun 'original-manifest.json')).Hash.ToLowerInvariant();
 fixtureManifestSha256=(Get-FileHash -LiteralPath $taskManifestPath).Hash.ToLowerInvariant();
 bootstrapSha256=(Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs')).Hash.ToLowerInvariant();
 profile=$taskProfile;workspace=$taskWorkspace;syntheticOnly=$true;extensionTestsPathUsed=$false;
 limitation='Test-only main delegates byte-identical VSIX bundle. Native persistent development context; not clean-profile install proof. No normal profile used or process killed.'}
$taskFreeze|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $taskRun 'freeze.json') -Encoding utf8 -NoClobber
foreach($taskPhase in @('save','reload')){
 $taskInfo=New-Object Diagnostics.ProcessStartInfo
 $taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
 $taskArgs=@("--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",
  '--disable-extensions','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object {if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'}) -join ' ')
 $taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true
 $taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
 $taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskName in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskName);if($taskValue){$taskInfo.EnvironmentVariables[$taskName]=$taskValue}}
 $taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile
 $taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming'
 $taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F02_PHASE']=$taskPhase
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F02_PROFILE']=$taskProfile
 $taskResultPath=Join-Path $taskRun ($taskPhase+'-results.json')
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F02_EVIDENCE']=$taskResultPath
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F02_BUNDLE_SHA256']=$taskHash
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F02_DRIVER_KIND']='native-bootstrap'
 $taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo
 try{
  [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync()
  $taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 120){}
  $taskTimeout=-not $taskProcess.HasExited
  $taskOutText=if($taskOut.IsCompleted){$taskOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
  $taskErrText=if($taskErr.IsCompleted){$taskErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
  $taskOutText|Out-File -LiteralPath (Join-Path $taskRun ($taskPhase+'-stdout.txt')) -Encoding utf8 -NoClobber
  $taskErrText|Out-File -LiteralPath (Join-Path $taskRun ($taskPhase+'-stderr.txt')) -Encoding utf8 -NoClobber
  if($taskTimeout){throw 'INCOMPLETE: native isolated window timeout; processes retained.'}
  if($taskProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $taskResultPath)){throw ('Native phase failed: '+$taskPhase)}
  $taskResults=Get-Content -LiteralPath $taskResultPath -Raw -Encoding UTF8|ConvertFrom-Json
  if($taskResults.failed -ne 0 -or (Test-Path -LiteralPath ($taskResultPath+'.driver-error.json'))){throw ('Native assertions failed: '+$taskPhase)}
  if((Get-FileHash -LiteralPath (Join-Path $taskSnapshot 'dist/extension.js')).Hash.ToLowerInvariant() -ne $taskHash){throw 'Bundle changed.'}
  Write-Output ('Native phase completed: '+$taskPhase)
 }finally{$taskProcess.Dispose()}
}
Write-Output ('Evidence: '+$taskRun)
