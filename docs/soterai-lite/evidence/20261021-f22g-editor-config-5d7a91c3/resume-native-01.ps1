$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Native resume stopped; original evidence retained: '+$Name)}
}
foreach($taskGate in @('full-tests-03','backend-typecheck-01','backend-tests-01','package-01','inspect-vsix-run-01')){
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskGate+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot ($taskGate+'.txt')) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskReceipt.sha256.ToLowerInvariant()){throw ('Current prerequisite failed: '+$taskGate)}
}
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskPrelaunch=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-fixture-validation-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
if([Diagnostics.FileVersionInfo]::GetVersionInfo($taskCode).ProductVersion -cne $taskPrelaunch.codeVersion -or (Get-FileHash -LiteralPath $taskCode -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskPrelaunch.codeSha256){throw 'Installed editor pin changed; no retry authorized by this fixture.'}
$taskVsix=[IO.Path]::GetFullPath($taskInspection.vsix);$taskVsixSha=$taskInspection.sha256;$taskBundleSha=$taskInspection.sourceProvenance.inventory|Where-Object{$_.name -ceq 'extension.js'}|Select-Object -ExpandProperty sha256
if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskVsixSha){throw 'Exact artifact changed.'}
foreach($taskDriver in $taskPrelaunch.compiled){$taskFile=Join-Path $PSScriptRoot ('prebuilt-native-hosts-01/'+$taskDriver.name);if((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskDriver.sha256){throw 'Frozen native driver changed.'}}
Invoke-Checked 'editor-native-run-02' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-editor-native-01.ps1'),'-CodePath',$taskCode,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-01/lite-editor-host.js'),'-ExtensionRoot',(Join-Path $PSScriptRoot 'vsix-extracted-01/extension'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
Invoke-Checked 'current-affected-suite-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-01.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
@{status='PASS_CURRENT_EXACT_OBJECT_NATIVE_AND_AFFECTED';vsixSha256=$taskVsixSha;extensionSha256=$taskBundleSha;scope='One unchanged bounded launch retry after reported updater mutex; no update/process/OS/normal-profile changes, signals, timing/driver/assertion edits or regrade.'}|ConvertTo-Json
