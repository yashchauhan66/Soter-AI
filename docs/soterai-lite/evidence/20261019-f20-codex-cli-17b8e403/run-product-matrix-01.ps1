$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw|ConvertFrom-Json
$taskPin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-01.json') -Raw|ConvertFrom-Json
$taskVendor=$taskPin.vendor
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
function Get-F20AHash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Write-F20ANew([string]$Path,[string]$Text){
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
 $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
if($taskInspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or (Get-F20AHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'Current exact artifact required'}
foreach($taskInput in $taskPin.files){if((Get-F20AHash $taskInput.path) -cne $taskInput.sha256){throw 'Installed public Claude pin changed'}}
$taskName='f20a-product-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f20a-product-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Fresh explicit synthetic root required'}
$taskEvidence=Join-Path $PSScriptRoot $taskName
$taskExtension=Join-Path $taskRoot 'extension'
$taskExtensions=Join-Path $taskRoot 'extensions'
$taskVendorCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/@openai/codex'
$taskProfile=Join-Path $taskRoot 'profile'
$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskDir in @($taskEvidence,$taskExtension,$taskVendorCopy,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,(Join-Path $taskExtension 'dist-test/host'))){[void][IO.Directory]::CreateDirectory($taskDir)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskInspection.extractedExtensionRoot -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked artifact source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskExtension -Recurse
}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskVendor -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked public vendor source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskVendorCopy -Recurse
}
foreach($taskInput in $taskPin.files){if((Get-F20AHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied public artifact differs'}}
$taskBindings=@()
foreach($taskRuntime in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')){
 $taskEntry=@($taskInspection.entries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntime)})
 if($taskEntry.Count -ne 1){throw 'Unique archive runtime required'}
 $taskBindings+=@{path=(Join-Path $taskExtension ('dist/'+$taskRuntime));sha256=$taskEntry[0].sha256}
}
function Assert-F20AProductBytes {
 foreach($taskBinding in $taskBindings){if((Get-F20AHash $taskBinding.path) -cne $taskBinding.sha256){throw 'Packaged runtime changed'}}
 foreach($taskInput in $taskPin.files){if((Get-F20AHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied vendor pin changed'}}
 if((Get-F20AHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'VSIX changed'}
}
$taskVendorPackage=Join-Path $taskVendorCopy 'package.json'
$taskProductManifest=Join-Path $taskExtension 'package.json'
Copy-Item -LiteralPath $taskProductManifest -Destination (Join-Path $taskEvidence 'product-original-manifest.json')
$taskManifest=Get-Content -LiteralPath $taskProductManifest -Raw|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard'){throw 'Unexpected product identity'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
[IO.File]::WriteAllText($taskProductManifest,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
foreach($taskDriver in @('product-matrix-01.cjs','matrix-guards-01.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskDriver) -Destination (Join-Path $taskExtension ('dist-test/host/'+$taskDriver))}
Write-F20ANew (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs') @'
const vscode=require('vscode'),fs=require('node:fs'),driver=require('./host/product-matrix-01.cjs');let actual;
exports.activate=async context=>{
 try{
  await driver.beforeActivate(context);actual=require('../dist/extension.js');await actual.activate(context);
  setTimeout(async()=>{try{await driver.run(context);}catch(error){fs.writeFileSync(process.env.SOTERAI_F20A_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'run',name:error.name,code:error.code})+'\n',{flag:'wx'});}finally{await vscode.commands.executeCommand('workbench.action.closeWindow');}},1500);
 }catch(error){fs.writeFileSync(process.env.SOTERAI_F20A_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'activate',name:error.name,code:error.code})+'\n',{flag:'wx'});await vscode.commands.executeCommand('workbench.action.closeWindow');}
};
exports.deactivate=()=>actual?.deactivate?.();
'@
$taskSettings=@{'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'extensions.ignoreRecommendations'=$true;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false}
Write-F20ANew (Join-Path $taskProfile 'User/settings.json') ($taskSettings|ConvertTo-Json -Depth 8)
$taskResult=Join-Path $taskRoot 'product-result.json'
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@('--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust',('--user-data-dir='+$taskProfile),('--extensions-dir='+$taskExtensions),('--extensionDevelopmentPath='+$taskExtension),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskRoot 'public-vendor';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=Join-Path $taskRoot 'empty-git-config';$taskInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0';$taskInfo.EnvironmentVariables['GCM_INTERACTIVE']='never';$taskInfo.EnvironmentVariables['SOTERAI_F20A_PRODUCT_ROOT']=$taskRoot;$taskInfo.EnvironmentVariables['SOTERAI_F20A_PRODUCT_RESULT']=$taskResult
$taskCodeSha=Get-F20AHash $taskCode
$taskFreeze=@{status='FROZEN_NOT_EXECUTED';executionRoot=$taskRoot;workspace=$taskWorkspace;profile=$taskProfile;vsix=$taskInspection.vsix;vsixSha256=$taskInspection.sha256;runtimeBindings=$taskBindings;vendorFiles=$taskPin.files;codeSha256=$taskCodeSha;codeVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode)).ProductVersion;driverSha256=(Get-F20AHash (Join-Path $PSScriptRoot 'product-matrix-01.cjs'));guardSha256=(Get-F20AHash (Join-Path $PSScriptRoot 'matrix-guards-01.cjs'));productBootstrapSha256=(Get-F20AHash (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs'));vendorLoadedManifestSha256=(Get-F20AHash $taskVendorPackage);productLoadedManifestSha256=(Get-F20AHash $taskProductManifest);independence='LOW';limitations='Product developer bootstrap and scripted native decisions; actual packaged runtime unchanged. Pinned native CLI executes from an isolated public npm copy; Codex IDE route UNVERIFIED. Provider Responses traffic/context remain unmediated. No clean-install/human/real-provider/OS/all-descendant claim; no agent process signals.'}
Write-F20ANew (Join-Path $taskEvidence 'freeze.json') ($taskFreeze|ConvertTo-Json -Depth 15)
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 300){}
 $taskTimedOut=-not $taskProcess.HasExited
 $taskOut=if($taskStdout.IsCompleted){$taskStdout.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
 $taskErr=if($taskStderr.IsCompleted){$taskStderr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
 Write-F20ANew (Join-Path $taskEvidence 'stdout.txt') $taskOut;Write-F20ANew (Join-Path $taskEvidence 'stderr.txt') $taskErr
 foreach($taskReceipt in @('product-result.json','product-result.json.driver-error.json')){if(Test-Path -LiteralPath (Join-Path $taskRoot $taskReceipt)){Copy-Item -LiteralPath (Join-Path $taskRoot $taskReceipt) -Destination (Join-Path $taskEvidence $taskReceipt)}}
 if($taskTimedOut){throw 'INCOMPLETE: owned test window retained; no process kill'}
 Assert-F20AProductBytes
 if((Get-F20AHash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
 if(-not(Test-Path -LiteralPath $taskResult)){throw 'INCOMPLETE: actual product result missing'}
 $taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json
 $taskObserved|Select-Object status,checks,configureStatus,cancelStatus,driverFailure,childShutdown,encryptedBackups,unownedNativeStatePreserved|ConvertTo-Json -Depth 6
 if($taskObserved.status -cne 'PASS_SCOPED_PRODUCT_CLI_MATRIX'){throw 'INCOMPLETE: current product CLI matrix did not pass'}
}finally{$taskProcess.Dispose()}
