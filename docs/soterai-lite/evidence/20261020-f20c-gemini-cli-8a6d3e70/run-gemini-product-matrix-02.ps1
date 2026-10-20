$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw|ConvertFrom-Json
$taskPin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-02.json') -Raw|ConvertFrom-Json
$taskVendor=$taskPin.vendor
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
function Get-F20CHash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Write-F20CNew([string]$Path,[string]$Text){
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
 $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
if($taskInspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or (Get-F20CHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'Current exact artifact required'}
foreach($taskInput in $taskPin.files){if((Get-F20CHash $taskInput.path) -cne $taskInput.sha256){throw 'Installed public Claude pin changed'}}
$taskName='f20c-product-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f20c-product-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Fresh explicit synthetic root required'}
$taskEvidence=Join-Path $PSScriptRoot $taskName
$taskExtension=Join-Path $taskRoot 'extension'
$taskExtensions=Join-Path $taskRoot 'extensions'
$taskVendorCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/@google/gemini-cli'
$taskProfile=Join-Path $taskRoot 'profile'
$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskDir in @($taskEvidence,$taskExtension,$taskVendorCopy,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,(Join-Path $taskExtension 'dist-test/host'))){[void][IO.Directory]::CreateDirectory($taskDir)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskInspection.extractedExtensionRoot -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked artifact source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskExtension -Recurse
}
foreach($taskInput in $taskPin.files){
 $taskDestination=Join-Path $taskVendorCopy $taskInput.relative
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskDestination))
 if((Get-Item -LiteralPath $taskInput.path).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked public input refused'}
 Copy-Item -LiteralPath $taskInput.path -Destination $taskDestination
 if((Get-F20CHash $taskDestination) -cne $taskInput.sha256){throw 'Copied selected public artifact differs'}
}
$taskDependencyCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/picomatch'
foreach($taskInput in $taskPin.dependencies[0].files){
 $taskDestination=Join-Path $taskDependencyCopy $taskInput.relative
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskDestination))
 Copy-Item -LiteralPath $taskInput.path -Destination $taskDestination
 if((Get-F20CHash $taskDestination) -cne $taskInput.sha256){throw 'Copied public dependency differs'}
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-02.json') -Destination (Join-Path $taskRoot 'reviewed-public-pin.json')
$taskBindings=@()
foreach($taskRuntime in @('extension.js','local-ai-broker.js','soterai-mcp-server.js')){
 $taskEntry=@($taskInspection.entries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntime)})
 if($taskEntry.Count -ne 1){throw 'Unique archive runtime required'}
 $taskBindings+=@{path=(Join-Path $taskExtension ('dist/'+$taskRuntime));sha256=$taskEntry[0].sha256}
}
function Assert-F20CProductBytes {
 foreach($taskBinding in $taskBindings){if((Get-F20CHash $taskBinding.path) -cne $taskBinding.sha256){throw 'Packaged runtime changed'}}
 foreach($taskInput in $taskPin.files){if((Get-F20CHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied vendor pin changed'}}
 foreach($taskInput in $taskPin.dependencies[0].files){if((Get-F20CHash (Join-Path $taskDependencyCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied dependency pin changed'}}
 if((Get-F20CHash $taskPin.node.path) -cne $taskPin.node.sha256){throw 'Public Node pin changed'}
 if((Get-F20CHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'VSIX changed'}
}
$taskVendorPackage=Join-Path $taskVendorCopy 'package.json'
$taskProductManifest=Join-Path $taskExtension 'package.json'
Copy-Item -LiteralPath $taskProductManifest -Destination (Join-Path $taskEvidence 'product-original-manifest.json')
$taskManifest=Get-Content -LiteralPath $taskProductManifest -Raw|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard'){throw 'Unexpected product identity'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
$taskManifest.activationEvents=@('*')
[IO.File]::WriteAllText($taskProductManifest,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
foreach($taskDriver in @('gemini-product-matrix-02.cjs','gemini-product-parent-guards-01.cjs','gemini-product-child-guards-01.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskDriver) -Destination (Join-Path $taskExtension ('dist-test/host/'+$taskDriver))}
Write-F20CNew (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs') @'
const vscode=require('vscode'),fs=require('node:fs'),driver=require('./host/gemini-product-matrix-02.cjs');let actual;
exports.activate=context=>new Promise(resolve=>{const work=async()=>{try{await driver.beforeActivate(context);actual=require('../dist/extension.js');await actual.activate(context);const result=await driver.run(context,resolve);if(result.nativeRetained){globalThis.__soteraiNativeRetained=true;return;}}catch(error){fs.writeFileSync(process.env.SOTERAI_F20C_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'activate-or-run',name:error.name,code:error.code})+'\n',{flag:'wx'});}finally{resolve();if(!globalThis.__soteraiNativeRetained)await vscode.commands.executeCommand('workbench.action.closeWindow');}};void work();});
exports.deactivate=()=>actual?.deactivate?.();
'@
$taskSettings=@{'chat.disableAIFeatures'=$true;'chatgpt.openOnStartup'=$false;'chatgpt.commentCodeLensEnabled'=$false;'chatgpt.runCodexInWindowsSubsystemForLinux'=$false;'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'extensions.ignoreRecommendations'=$true;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false}
Write-F20CNew (Join-Path $taskProfile 'User/settings.json') ($taskSettings|ConvertTo-Json -Depth 8)
$taskResult=Join-Path $taskRoot 'product-result.json'
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@('--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust',('--user-data-dir='+$taskProfile),('--extensions-dir='+$taskExtensions),('--extensionDevelopmentPath='+$taskExtension),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskRoot 'public-vendor';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['ProgramFiles']='C:\Program Files'
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=Join-Path $taskRoot 'empty-git-config';$taskInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0';$taskInfo.EnvironmentVariables['GCM_INTERACTIVE']='never';$taskInfo.EnvironmentVariables['SOTERAI_F20C_PRODUCT_ROOT']=$taskRoot;$taskInfo.EnvironmentVariables['SOTERAI_F20C_PRODUCT_RESULT']=$taskResult
$taskCodeSha=Get-F20CHash $taskCode
$taskFreeze=@{status='FROZEN_NOT_EXECUTED';executionRoot=$taskRoot;workspace=$taskWorkspace;profile=$taskProfile;vsix=$taskInspection.vsix;vsixSha256=$taskInspection.sha256;runtimeBindings=$taskBindings;vendorFiles=$taskPin.files;codeSha256=$taskCodeSha;codeVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode)).ProductVersion;driverSha256=(Get-F20CHash (Join-Path $PSScriptRoot 'gemini-product-matrix-02.cjs'));guardSha256=(Get-F20CHash (Join-Path $PSScriptRoot 'gemini-product-parent-guards-01.cjs'));productBootstrapSha256=(Get-F20CHash (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs'));vendorLoadedManifestSha256=(Get-F20CHash $taskVendorPackage);productLoadedManifestSha256=(Get-F20CHash $taskProductManifest);independence='LOW';limitations='Product developer bootstrap and scripted native decisions; actual packaged runtime unchanged. Pinned Gemini0.55.1 selected manifest/bundle and public picomatch execute from exact isolated copies with pinned Node22.16.0; optional native-addon routes not certified. Restricted native HTTP text GenerateContent are buffered for complete inspection; explicit overrides/other profiles remain uncovered. No clean-install/human/real-provider/OS/all-descendant claim; no agent process signals.'}
Write-F20CNew (Join-Path $taskEvidence 'freeze.json') ($taskFreeze|ConvertTo-Json -Depth 15)
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskStdout=$taskProcess.StandardOutput.ReadToEndAsync();$taskStderr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 300){}
 $taskTimedOut=-not $taskProcess.HasExited
 $taskOut=if($taskStdout.IsCompleted){$taskStdout.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
 $taskErr=if($taskStderr.IsCompleted){$taskStderr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
 Write-F20CNew (Join-Path $taskEvidence 'stdout.txt') $taskOut;Write-F20CNew (Join-Path $taskEvidence 'stderr.txt') $taskErr
 foreach($taskReceipt in @('product-result.json','product-result.json.driver-error.json')){if(Test-Path -LiteralPath (Join-Path $taskRoot $taskReceipt)){Copy-Item -LiteralPath (Join-Path $taskRoot $taskReceipt) -Destination (Join-Path $taskEvidence $taskReceipt)}}
 if($taskTimedOut){throw 'INCOMPLETE: owned test window retained; no process kill'}
 Assert-F20CProductBytes
 if((Get-F20CHash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
 if(-not(Test-Path -LiteralPath $taskResult)){throw 'INCOMPLETE: actual product result missing'}
 $taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json
 $taskObserved|Select-Object status,checks,configureStatus,cancelStatus,driverFailure,childShutdown,encryptedBackups,unownedNativeStatePreserved|ConvertTo-Json -Depth 6
 if($taskObserved.status -cne 'PASS_SCOPED_PRODUCT_GEMINI_MATRIX'){throw 'INCOMPLETE: current product Gemini matrix did not pass'}
}finally{$taskProcess.Dispose()}
