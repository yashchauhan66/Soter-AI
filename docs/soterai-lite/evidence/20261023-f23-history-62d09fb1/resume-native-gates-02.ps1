$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F23ResumeGate([string]$Name,[string]$Program,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-inputs-03.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current source/native fixture drift.'}
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Resume gate failed; evidence retained: '+$Name)}
}
$taskClosure=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'failed-native-closure-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskClosure.runnerAbsent -ne $true -or $taskClosure.innerExitCode -ne 1){throw 'Prior failed owned runner closure required.'}
Invoke-F23ResumeGate 'build-native-hosts-run-02' 'node' @((Join-Path $PSScriptRoot 'build-native-hosts-03.cjs'),'prebuilt-native-hosts-03')
Invoke-F23ResumeGate 'verify-native-rebuild-run-02' 'node' @((Join-Path $PSScriptRoot 'verify-native-rebuild-02.cjs'))
$taskPackage=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package-01.txt') -Encoding UTF8|Where-Object {$_ -match '^\{"status":"PACKAGED_NOT_HOST_VERIFIED",'}|Select-Object -Last 1|ConvertFrom-Json
if(-not $taskPackage){throw 'Existing exact new package receipt missing.'}
$taskVsix=Join-Path $taskRepo $taskPackage.output
$taskCommon=@('-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskPackage.sha256,'-ExpectedBundleSha256',$taskPackage.extensionSha256)
. (Join-Path $PSScriptRoot 'host-current-binding-06.ps1')
Assert-F23EditorHost
Invoke-F23ResumeGate 'history-native-run-02' 'powershell' (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-history-native-02.ps1'),'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-03/lite-history-host.js'),'-ExtensionRoot',(Join-Path $PSScriptRoot 'vsix-extracted-01/extension'))+$taskCommon)
Invoke-F23ResumeGate 'current-affected-suite-run-01' 'powershell' (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-04.ps1'))+$taskCommon)
Assert-F23EditorHost
@{status='PASS_SCOPED_F23_CURRENT_NATIVE_AFTER_FIXTURE_ONLY_CORRECTION';vsixSha256=$taskPackage.sha256;extensionSha256=$taskPackage.extensionSha256}|ConvertTo-Json
exit 0
