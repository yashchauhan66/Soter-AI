$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw|ConvertFrom-Json
$taskVendor='C:\Users\USER\.vscode\extensions\saoudrizwan.claude-dev-4.1.25'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskVendorPackageSha='4a91298536329c8987b77223c06d3a6778af3a7e3678ed7173dd430f3636d7eb'
$taskVendorRuntimeSha='a3e8eda18b38547df9c614e62d04106cdf3bf2df2cb16241af3f7b3770088022'
function Get-F18Hash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
if($taskInspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or (Get-F18Hash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'Current exact artifact required'}
if((Get-F18Hash (Join-Path $taskVendor 'package.json')) -cne $taskVendorPackageSha -or (Get-F18Hash (Join-Path $taskVendor 'dist/extension.js')) -cne $taskVendorRuntimeSha){throw 'Installed public Cline pin changed'}
$taskName='f18-product-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f18-product-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Existing or unexpected synthetic root'}
$taskEvidence=Join-Path $PSScriptRoot $taskName
$taskExtension=Join-Path $taskRoot 'extension'
$taskExtensions=Join-Path $taskRoot 'extensions'
$taskVendorCopy=Join-Path $taskExtensions 'saoudrizwan.claude-dev-4.1.25'
$taskProfile=Join-Path $taskRoot 'profile'
$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskDir in @($taskEvidence,$taskExtension,$taskVendorCopy,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,(Join-Path $taskExtension 'dist-test/host'))){[void][IO.Directory]::CreateDirectory($taskDir)}
function Write-F18New([string]$Path,[string]$Text){
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
 $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskInspection.extractedExtensionRoot -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskExtension -Recurse
}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskVendor -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked public vendor artifact refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskVendorCopy -Recurse
}
$taskBindings=@()
foreach($taskRuntime in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')){
 $taskEntry=@($taskInspection.entries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntime)})
 if($taskEntry.Count -ne 1){throw 'Unique archive runtime required'}
 $taskBindings+=@{path=(Join-Path $taskExtension ('dist/'+$taskRuntime));sha256=$taskEntry[0].sha256}
}
function Assert-F18ProductBytes {
 foreach($taskBinding in $taskBindings){if((Get-F18Hash $taskBinding.path) -cne $taskBinding.sha256){throw 'Packaged runtime changed'}}
 if((Get-F18Hash (Join-Path $taskVendorCopy 'dist/extension.js')) -cne $taskVendorRuntimeSha){throw 'Vendor runtime changed'}
 if((Get-F18Hash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'Artifact changed'}
}
Assert-F18ProductBytes
$taskOriginalVendor=Join-Path $taskVendorCopy 'package.json'
if((Get-F18Hash $taskOriginalVendor) -cne $taskVendorPackageSha){throw 'Copied vendor package bytes differ'}
Copy-Item -LiteralPath $taskOriginalVendor -Destination (Join-Path $taskVendorCopy '.f18-original-package.json')
Copy-Item -LiteralPath $taskOriginalVendor -Destination (Join-Path $taskEvidence 'vendor-original-manifest.json')
$taskVendorManifest=Get-Content -LiteralPath $taskOriginalVendor -Raw|ConvertFrom-Json
$taskVendorManifest.main='./f18-vendor-bootstrap.cjs'
[IO.File]::WriteAllText($taskOriginalVendor,($taskVendorManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
Write-F18New (Join-Path $taskVendorCopy 'f18-vendor-bootstrap.cjs') @'
exports.activate=async context=>{
 const deadline=Date.now()+30000;
 while(typeof globalThis.__SOTERAI_F18_ACTIVATE_VENDOR__!=='function'){
  if(Date.now()>deadline)throw Error('Synthetic product guard unavailable');
  await new Promise(done=>setTimeout(done,25));
 }
 return globalThis.__SOTERAI_F18_ACTIVATE_VENDOR__(context);
};
exports.deactivate=()=>{}; // Actual vendor cooperative shutdown is owned by the fixture.
'@
$taskProductManifest=Join-Path $taskExtension 'package.json'
Copy-Item -LiteralPath $taskProductManifest -Destination (Join-Path $taskEvidence 'product-original-manifest.json')
$taskManifest=Get-Content -LiteralPath $taskProductManifest -Raw|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard'){throw 'Unexpected product identity'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
[IO.File]::WriteAllText($taskProductManifest,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
foreach($taskDriver in @('product-probe-04.cjs','product-test-guards-03.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskDriver) -Destination (Join-Path $taskExtension ('dist-test/host/'+$taskDriver))}
Write-F18New (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs') @'
const vscode=require('vscode'),fs=require('node:fs');
const driver=require('./host/product-probe-04.cjs');let actual;
exports.activate=async context=>{
 try{
  await driver.beforeActivate(context);actual=require('../dist/extension.js');await actual.activate(context);
  setTimeout(async()=>{try{await driver.run(context);}catch(error){fs.writeFileSync(process.env.SOTERAI_F18_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'run',name:error.name,code:error.code})+'\n',{flag:'wx'});}
   finally{await vscode.commands.executeCommand('workbench.action.closeWindow');}},1500);
 }catch(error){fs.writeFileSync(process.env.SOTERAI_F18_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'activate',name:error.name,code:error.code})+'\n',{flag:'wx'});await vscode.commands.executeCommand('workbench.action.closeWindow');}
};
exports.deactivate=()=>actual?.deactivate?.();
'@
$taskSettings=@{'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'extensions.ignoreRecommendations'=$true;'cline.telemetrySetting'='disabled';'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false}
Write-F18New (Join-Path $taskProfile 'User/settings.json') ($taskSettings|ConvertTo-Json -Depth 8)
$taskGitConfig=Join-Path $taskRoot 'empty-git-config';Write-F18New $taskGitConfig ''
$taskResult=Join-Path $taskRoot 'product-result.json'
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@('--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust',('--user-data-dir='+$taskProfile),('--extensions-dir='+$taskExtensions),('--extensionDevelopmentPath='+$taskExtension),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=$taskGitConfig;$taskInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0';$taskInfo.EnvironmentVariables['GCM_INTERACTIVE']='never'
$taskInfo.EnvironmentVariables['DO_NOT_TRACK']='1';$taskInfo.EnvironmentVariables['DISABLE_TELEMETRY']='1';$taskInfo.EnvironmentVariables['SOTERAI_F18_PRODUCT_ROOT']=$taskRoot;$taskInfo.EnvironmentVariables['SOTERAI_F18_PRODUCT_RESULT']=$taskResult
$taskCodeSha=Get-F18Hash $taskCode
$taskFreeze=@{status='FROZEN_SCOPED_PRODUCT_PROBE_NOT_ACCEPTANCE';createdAt=[DateTime]::UtcNow.ToString('o');executionRoot=$taskRoot;workspace=$taskWorkspace;profile=$taskProfile;vsix=$taskInspection.vsix;vsixSha256=$taskInspection.sha256;runtimeBindings=$taskBindings;vendorPackageSha256=$taskVendorPackageSha;vendorRuntimeSha256=$taskVendorRuntimeSha;codeSha256=$taskCodeSha;codeVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode)).ProductVersion;driverSha256=(Get-F18Hash (Join-Path $PSScriptRoot 'product-probe-04.cjs'));guardSha256=(Get-F18Hash (Join-Path $PSScriptRoot 'product-test-guards-03.cjs'));vendorBootstrapSha256=(Get-F18Hash (Join-Path $taskVendorCopy 'f18-vendor-bootstrap.cjs'));productBootstrapSha256=(Get-F18Hash (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs'));vendorLoadedManifestSha256=(Get-F18Hash $taskOriginalVendor);productLoadedManifestSha256=(Get-F18Hash $taskProductManifest);independence='LOW';limitations='Developer bootstraps and scripted native decisions; original packaged product and pinned vendor runtime bytes unchanged. Vendor original package restored before artifact check. No clean install, human evidence or OS/descendant traffic certification. Signals refused; synthetic only.'}
Write-F18New (Join-Path $taskEvidence 'freeze.json') ($taskFreeze|ConvertTo-Json -Depth 12)
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 180){}
 $taskTimedOut=-not $taskProcess.HasExited
 $taskOut=if($taskStdout.IsCompleted){$taskStdout.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
 $taskErr=if($taskStderr.IsCompleted){$taskStderr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
 Write-F18New (Join-Path $taskEvidence 'stdout.txt') $taskOut;Write-F18New (Join-Path $taskEvidence 'stderr.txt') $taskErr
 foreach($taskReceipt in @('product-result.json','product-result.json.driver-error.json','tool-schemas.json')){if(Test-Path -LiteralPath (Join-Path $taskRoot $taskReceipt)){Copy-Item -LiteralPath (Join-Path $taskRoot $taskReceipt) -Destination (Join-Path $taskEvidence $taskReceipt)}}
 if($taskTimedOut){throw 'INCOMPLETE: window retained; no process kill'}
 Assert-F18ProductBytes
 if((Get-F18Hash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
 if(Test-Path -LiteralPath $taskResult){$taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json;$taskObserved|Select-Object status,checks,configureStatus,cancelStatus,brokerStages,controllerStages,tokenShape,tokenFailure,withdrawals,driverFailure,childShutdown|ConvertTo-Json -Depth 8;if($taskObserved.status -cne 'PASS_SCOPED_PRODUCT_PROBE'){throw 'INCOMPLETE: actual product assertions did not pass'}}else{throw 'INCOMPLETE: actual product result missing'}
}finally{$taskProcess.Dispose()}
