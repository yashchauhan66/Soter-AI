$ErrorActionPreference='Stop'
$taskPin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-01.json') -Raw|ConvertFrom-Json
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
function Get-F20BHash([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Write-F20BNew([string]$File,[string]$Text){
 $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text)
 $taskStream=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
}
foreach($taskInput in $taskPin.files){if((Get-F20BHash $taskInput.path) -cne $taskInput.sha256){throw 'Installed public IDE bytes changed'}}
$taskName='f20b-feasibility-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f20b-feasibility-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Fresh exact synthetic root required'}
$taskEvidence=Join-Path $PSScriptRoot $taskName
$taskVendorCopy=Join-Path $taskRoot 'extensions/openai.chatgpt-26.51007.21434-win32-x64'
$taskFixture=Join-Path $taskRoot 'fixture'
$taskProfile=Join-Path $taskRoot 'profile'
$taskWorkspace=Join-Path $taskRoot 'workspace'
$taskHome=Join-Path $taskRoot 'code-home'
foreach($taskDirectory in @($taskEvidence,$taskVendorCopy,$taskFixture,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskHome)){[void][IO.Directory]::CreateDirectory($taskDirectory)}
$taskLinked=@(Get-ChildItem -LiteralPath $taskPin.vendor -Force -Recurse|Where-Object{$_.Attributes -band [IO.FileAttributes]::ReparsePoint})
if($taskLinked.Count -ne 0){throw 'Linked public vendor tree refused'}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskPin.vendor -Force){Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskVendorCopy -Recurse}
$taskAdditionalBindings=@()
foreach($taskNative in Get-ChildItem -LiteralPath (Join-Path $taskPin.vendor 'bin/windows-x86_64') -File -Recurse|Where-Object{$_.Extension -in @('.exe','.dll','.node')}){
 $taskRelative=$taskNative.FullName.Substring(([IO.Path]::GetFullPath($taskPin.vendor)).Length+1)
 $taskSourceSha=Get-F20BHash $taskNative.FullName
 if((Get-F20BHash (Join-Path $taskVendorCopy $taskRelative)) -cne $taskSourceSha){throw 'Copied native resource differs'}
 $taskAdditionalBindings+=@{relative=$taskRelative;bytes=$taskNative.Length;sha256=$taskSourceSha}
}
foreach($taskInput in $taskPin.files){if((Get-F20BHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied public IDE bytes differ'}}
$taskVendorManifest=Join-Path $taskVendorCopy 'package.json'
Copy-Item -LiteralPath $taskVendorManifest -Destination (Join-Path $taskEvidence 'vendor-original-manifest.json')
$taskManifest=Get-Content -LiteralPath $taskVendorManifest -Raw|ConvertFrom-Json
$taskManifest.activationEvents=@()
# chatSessions implies automatic activation even when activationEvents is empty.
# Suppress only that contribution in the isolated copy, retain original manifest.
$taskManifest.contributes.PSObject.Properties.Remove('chatSessions')
[IO.File]::WriteAllText($taskVendorManifest,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
foreach($taskFile in @('ide-feasibility-03.cjs','ide-guards-03.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskFile) -Destination (Join-Path $taskFixture $taskFile)}
Write-F20BNew (Join-Path $taskFixture 'package.json') (@{name='soterai-f20b-feasibility';publisher='synthetic-local';version='0.0.1';engines=@{vscode='^1.95.0'};main='./bootstrap.cjs';activationEvents=@('onStartupFinished')}|ConvertTo-Json -Depth 6)
Write-F20BNew (Join-Path $taskFixture 'bootstrap.cjs') @'
const fs=require('node:fs'),vscode=require('vscode');
exports.activate=async context=>{try{await require('./ide-feasibility-03.cjs').activate(context);}catch(error){fs.writeFileSync(process.env.SOTERAI_F20B_ROOT+'/bootstrap-error.json',JSON.stringify({name:error.name,code:error.code,message:String(error.message).slice(0,256)})+'\n',{flag:'wx'});await vscode.commands.executeCommand('workbench.action.closeWindow');}};
'@
$taskSettings=@{'security.workspace.trust.enabled'=$false;'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'workbench.enableExperiments'=$false;'window.restoreWindows'='none';'workbench.startupEditor'='none';'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'extensions.ignoreRecommendations'=$true;'chatgpt.openOnStartup'=$false;'chatgpt.commentCodeLensEnabled'=$false;'chatgpt.runCodexInWindowsSubsystemForLinux'=$false}
Write-F20BNew (Join-Path $taskProfile 'User/settings.json') ($taskSettings|ConvertTo-Json -Depth 8)
Write-F20BNew (Join-Path $taskRoot 'empty-git-config') ''
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@('--new-window','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes','--disable-workspace-trust',('--user-data-dir='+$taskProfile),('--extensions-dir='+(Join-Path $taskRoot 'extensions')),('--extensionDevelopmentPath='+$taskFixture),'--disable-extension=vscode.json-language-features','--disable-extension=vscode.configuration-editing','--disable-extension=vscode.github','--disable-extension=vscode.git','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm',$taskWorkspace)
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['HOME']=$taskProfile;$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['CODEX_HOME']=$taskHome
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Windows\System32\WindowsPowerShell\v1.0;C:\Program Files\Git\cmd;C:\Program Files\nodejs'
$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=Join-Path $taskRoot 'empty-git-config';$taskInfo.EnvironmentVariables['GIT_TERMINAL_PROMPT']='0';$taskInfo.EnvironmentVariables['GCM_INTERACTIVE']='never';$taskInfo.EnvironmentVariables['SOTERAI_F20B_ROOT']=$taskRoot
$taskFreeze=@{status='FROZEN_NOT_EXECUTED';root=$taskRoot;profile=$taskProfile;workspace=$taskWorkspace;codeHome=$taskHome;vendorFiles=$taskPin.files;additionalNativeResources=$taskAdditionalBindings;vendorLoadedManifestSha256=(Get-F20BHash $taskVendorManifest);vendorActivation='Explicit activate after synthetic configuration; loaded manifest activationEvents empty and chatSessions contribution removed to prevent implicit preactivation, vendor JS/native bytes unchanged';driverSha256=(Get-F20BHash (Join-Path $taskFixture 'ide-feasibility-03.cjs'));guardSha256=(Get-F20BHash (Join-Path $taskFixture 'ide-guards-03.cjs'));bootstrapSha256=(Get-F20BHash (Join-Path $taskFixture 'bootstrap.cjs'));codeSha256=(Get-F20BHash $taskCode);independence='LOW';scope='IDE native/client feasibility only; no SoterAI product runtime, webview/human/login/real-provider/OS/all-descendant claim'}
Write-F20BNew (Join-Path $taskEvidence 'freeze.json') ($taskFreeze|ConvertTo-Json -Depth 16)
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
 while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 100){}
 $taskTimedOut=-not $taskProcess.HasExited
 Write-F20BNew (Join-Path $taskEvidence 'stdout.txt') $(if($taskOut.IsCompleted){$taskOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'})
 Write-F20BNew (Join-Path $taskEvidence 'stderr.txt') $(if($taskErr.IsCompleted){$taskErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'})
 foreach($taskFile in @('ide-result.json','bootstrap-error.json','native-request-01.json','phase-activation-02.json')){if(Test-Path -LiteralPath (Join-Path $taskRoot $taskFile)){Copy-Item -LiteralPath (Join-Path $taskRoot $taskFile) -Destination (Join-Path $taskEvidence $taskFile)}}
 foreach($taskInput in $taskPin.files|Where-Object{$_.relative -cne 'package.json'}){if((Get-F20BHash (Join-Path $taskVendorCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Actual vendor runtime bytes changed'}}
 if($taskTimedOut){throw 'INCOMPLETE owned window retained; no process signals sent'}
 if(-not(Test-Path -LiteralPath (Join-Path $taskEvidence 'ide-result.json'))){throw 'Actual IDE result unavailable; retained all evidence'}
 $taskResult=Get-Content -LiteralPath (Join-Path $taskEvidence 'ide-result.json') -Raw|ConvertFrom-Json
 $taskResult|Select-Object status,ownerFound,viewCount,routeCompleted,turnStatus,driverFailure,nativeRetainedWithoutSignal,native|ConvertTo-Json -Depth 6
 if($taskResult.status -cne 'PASS_SCOPED_IDE_CLIENT_FEASIBILITY'){throw 'Actual IDE client feasibility incomplete'}
}finally{$taskProcess.Dispose()}
