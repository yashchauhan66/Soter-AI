$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F23CandidateGate([string]$Name,[string]$Program,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current input drift before candidate gate.'}
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Candidate gate failed; evidence retained: '+$Name)}
}
$taskSerial=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-serial-exit-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskSerial.status -cne 'PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS' -or $taskSerial.innerExitCode -ne 0 -or $taskSerial.runnerAbsent -ne $true){throw 'Current serial completion and owned runner closure required.'}
. (Join-Path $PSScriptRoot 'host-current-binding-05.ps1')
Assert-F23EditorHost
Invoke-F23CandidateGate 'package-01' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f23-20261023-attempt01.vsix')
$taskPackage=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package-01.txt') -Encoding UTF8|Where-Object {$_ -match '^\{"status":"PACKAGED_NOT_HOST_VERIFIED",'}|Select-Object -Last 1|ConvertFrom-Json
if(-not $taskPackage){throw 'Exact new package receipt required.'}
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f23-20261023-attempt01.vsix'
if([IO.Path]::GetFullPath((Join-Path $taskRepo $taskPackage.output)) -cne [IO.Path]::GetFullPath($taskVsix)){throw 'Unexpected new VSIX identity.'}
if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskPackage.sha256 -or (Get-Item -LiteralPath $taskVsix).Length -ne $taskPackage.bytes){throw 'New VSIX differs from package receipt.'}
$taskCommon=@('-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskPackage.sha256,'-ExpectedBundleSha256',$taskPackage.extensionSha256)
Invoke-F23CandidateGate 'inspect-vsix-run-01' 'powershell' (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'inspect-vsix-01.ps1'))+$taskCommon+@('-InspectionName','01'))
Assert-F23EditorHost
Invoke-F23CandidateGate 'history-native-run-01' 'powershell' (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-history-native-01.ps1'),'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-history-host.js'),'-ExtensionRoot',(Join-Path $PSScriptRoot 'vsix-extracted-01/extension'))+$taskCommon)
Assert-F23EditorHost
Invoke-F23CandidateGate 'current-affected-suite-run-01' 'powershell' (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-04.ps1'))+$taskCommon)
Assert-F23EditorHost
@{status='PASS_SCOPED_CURRENT_F23_CANDIDATE01';vsixSha256=$taskPackage.sha256;extensionSha256=$taskPackage.extensionSha256;scope='Exact history25/affectednative/functional/security; acceptance+local byte barriers remain pending.'}|ConvertTo-Json
exit 0
