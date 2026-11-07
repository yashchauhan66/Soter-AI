param([Parameter(Mandatory=$true)][string]$AdmissionPath,[Parameter(Mandatory=$true)][string]$AdmissionSha256)
$ErrorActionPreference='Stop'
if((Get-FileHash -LiteralPath $AdmissionPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $AdmissionSha256){throw 'Current route admission digest differs'}
$taskRouteAdmission=Get-Content -LiteralPath $AdmissionPath -Raw|ConvertFrom-Json
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'current-inspection.json') -Raw|ConvertFrom-Json
$taskPin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installed-ide-public-inputs-01.json') -Raw|ConvertFrom-Json
$taskVendor=$taskPin.vendor
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
function Get-F20BHash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Write-F20BNew([string]$Path,[string]$Text){
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
 $taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
if($taskInspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or (Get-F20BHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'Current exact artifact required'}
foreach($taskInput in $taskPin.files){if((Get-F20BHash $taskInput.path) -cne $taskInput.sha256){throw 'Installed public Claude pin changed'}}
$taskName=[IO.Path]::GetFileName($taskRouteAdmission.runRoot)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f20b-product-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Fresh explicit synthetic root required'}
$taskEvidence=$taskRouteAdmission.receipts
$taskExtension=Join-Path $taskRoot 'extension'
$taskExtensions=Join-Path $taskRoot 'extensions'
$taskVendorCopy=Join-Path $taskRoot 'extensions/openai.chatgpt-26.51007.21434-win32-x64'
$taskProfile=Join-Path $taskRoot 'profile'
$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskDir in @($taskEvidence,$taskExtension,$taskVendorCopy,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,(Join-Path $taskExtension 'dist-test/host'))){[void][IO.Directory]::CreateDirectory($taskDir)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskInspection.extractedExtensionRoot -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked artifact source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskExtension -Recurse
}
if(@(Get-ChildItem -LiteralPath $taskVendor -Force -Recurse|Where-Object{$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count -ne 0){throw 'Linked public vendor tree refused'}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskVendor -Force){
 if($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked public vendor source refused'}
 Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskVendorCopy -Recurse
}
foreach($taskInput in $taskPin.files){if((Get-F20BHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied public artifact differs'}}
$taskBindings=@()
foreach($taskRuntime in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){
 $taskEntry=@($taskInspection.entries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntime)})
 if($taskEntry.Count -ne 1){throw 'Unique archive runtime required'}
 $taskBindings+=@{path=(Join-Path $taskExtension ('dist/'+$taskRuntime));sha256=$taskEntry[0].sha256}
}
function Assert-F20BProductBytes {
 foreach($taskBinding in $taskBindings){if((Get-F20BHash $taskBinding.path) -cne $taskBinding.sha256){throw 'Packaged runtime changed'}}
 foreach($taskInput in $taskPin.files){if((Get-F20BHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied vendor pin changed'}}
 if((Get-F20BHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'VSIX changed'}
}
$taskVendorPackage=Join-Path $taskVendorCopy 'package.json'
$taskProductManifest=Join-Path $taskExtension 'package.json'
Copy-Item -LiteralPath $taskProductManifest -Destination (Join-Path $taskEvidence 'product-original-manifest.json')
$taskManifest=Get-Content -LiteralPath $taskProductManifest -Raw|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard'){throw 'Unexpected product identity'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
$taskManifest.activationEvents=@('*')
[IO.File]::WriteAllText($taskProductManifest,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
foreach($taskDriver in @('ide-product-matrix-04.cjs','ide-product-guards-01.cjs','ide-native-client-02.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskDriver) -Destination (Join-Path $taskExtension ('dist-test/host/'+$taskDriver))}
Write-F20BNew (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs') @'
const cp=require('node:child_process'),ownedChildren=[],ownedSpawn=cp.spawn;
cp.spawn=function(...args){const child=Reflect.apply(ownedSpawn,this,args),row={closed:false,stdoutEOF:!child.stdout,stderrEOF:!child.stderr};ownedChildren.push(row);child.once('close',()=>row.closed=true);child.stdout?.once('end',()=>row.stdoutEOF=true);child.stderr?.once('end',()=>row.stderrEOF=true);return child;};
async function closeOwnedWindow(){const pending=ownedChildren.filter(row=>!row.closed||!row.stdoutEOF||!row.stderrEOF);if(pending.length){fs.writeFileSync(process.env.SOTERAI_F20B_PRODUCT_RESULT+'.stop-unconfirmed.json',JSON.stringify({status:'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEXT_PHASE',pendingChildren:pending.length,signalsRequested:0})+'\n',{flag:'wx'});return;}await vscode.commands.executeCommand('workbench.action.closeWindow');}
const vscode=require('vscode'),fs=require('node:fs'),driver=require('./host/ide-product-matrix-04.cjs');let actual;
exports.activate=context=>new Promise(resolve=>{const work=async()=>{try{await driver.beforeActivate(context);actual=require('../dist/extension.js');await actual.activate(context);await driver.run(context,resolve);}catch(error){fs.writeFileSync(process.env.SOTERAI_F20B_PRODUCT_RESULT+'.driver-error.json',JSON.stringify({stage:'activate-or-run',name:error.name,code:error.code})+'\n',{flag:'wx'});}finally{resolve();await closeOwnedWindow();}};void work();});
exports.deactivate=()=>actual?.deactivate?.();
'@
$taskSettings=@{'chat.disableAIFeatures'=$true;'chatgpt.openOnStartup'=$false;'chatgpt.commentCodeLensEnabled'=$false;'chatgpt.runCodexInWindowsSubsystemForLinux'=$false;'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'extensions.ignoreRecommendations'=$true;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false}
Write-F20BNew (Join-Path $taskProfile 'User/settings.json') ($taskSettings|ConvertTo-Json -Depth 8)
$taskResult=Join-Path $taskRoot 'product-result.json'
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@('--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust',('--user-data-dir='+$taskProfile),('--extensions-dir='+$taskExtensions),('--extensionDevelopmentPath='+$taskExtension),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
$taskInfo.EnvironmentVariables['CODEX_HOME']=Join-Path $taskRoot 'code-home'
[void][IO.Directory]::CreateDirectory((Join-Path $taskRoot 'code-home'))
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=Join-Path $taskRoot 'empty-git-config';$taskInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0';$taskInfo.EnvironmentVariables['GCM_INTERACTIVE']='never';$taskInfo.EnvironmentVariables['SOTERAI_F20B_PRODUCT_ROOT']=$taskRoot;$taskInfo.EnvironmentVariables['SOTERAI_F20B_PRODUCT_RESULT']=$taskResult
$taskCodeSha=Get-F20BHash $taskCode
$taskFreeze=@{status='FROZEN_NOT_EXECUTED';executionRoot=$taskRoot;workspace=$taskWorkspace;profile=$taskProfile;vsix=$taskInspection.vsix;vsixSha256=$taskInspection.sha256;runtimeBindings=$taskBindings;vendorFiles=$taskPin.files;codeSha256=$taskCodeSha;codeVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode)).ProductVersion;driverSha256=(Get-F20BHash (Join-Path $PSScriptRoot 'ide-product-matrix-04.cjs'));guardSha256=(Get-F20BHash (Join-Path $PSScriptRoot 'ide-product-guards-01.cjs'));productBootstrapSha256=(Get-F20BHash (Join-Path $taskExtension 'dist-test/native-bootstrap.cjs'));vendorLoadedManifestSha256=(Get-F20BHash $taskVendorPackage);productLoadedManifestSha256=(Get-F20BHash $taskProductManifest);independence='LOW';limitations='Product developer bootstrap and scripted native decisions; actual packaged runtime unchanged. Pinned IDE JavaScript and bundled native execute from an isolated exact public copy; original vendor manifest retained; physical webview route UNVERIFIED. Restricted native HTTP text Responses are buffered for complete inspection; explicit overrides/other profiles remain uncovered. No clean-install/human/real-provider/OS/all-descendant claim; no agent process signals.'}
Write-F20BNew (Join-Path $taskEvidence 'freeze.json') ($taskFreeze|ConvertTo-Json -Depth 15)

$taskEnv=@{}
foreach($taskEnvKey in $taskInfo.EnvironmentVariables.Keys){$taskEnv[$taskEnvKey]=[string]$taskInfo.EnvironmentVariables[$taskEnvKey]}
$taskLaunch=Join-Path $taskEvidence 'code-launch.json'
Write-F20BNew $taskLaunch (@{admissionPath=$AdmissionPath;admissionSha256=$AdmissionSha256;executable=$taskCode;args=$taskArgs;cwd=$taskWorkspace;env=$taskEnv;run=$taskEvidence;profile=$taskProfile;deadlineMs=300000}|ConvertTo-Json -Depth 15)
& 'C:\Program Files\nodejs\node.exe' 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-remaining-queue\f26a\codex-routes-02.cjs' --code $taskLaunch
if($LASTEXITCODE -ne 0){throw 'Actual owned Code close/result incomplete; no retry or signals'}
Assert-F20BProductBytes
if((Get-F20BHash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
if(-not(Test-Path -LiteralPath $taskResult)){throw 'Actual native result missing'}
$taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json
if($taskObserved.status -cne 'PASS_SCOPED_PRODUCT_IDE_MATRIX'){throw 'Original native matrix did not pass'}
