$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; raw evidence retained: '+$Name)}
}
$taskFull=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-tests-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFull.exitCode -ne 0){throw 'Fresh serial full suite must pass before candidate01 gates.'}
Invoke-Checked 'package-01' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f22c-20261021-attempt01.vsix')
$taskPackage=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package-01.txt') -Encoding UTF8|Where-Object {$_ -match '^\{"status":"PACKAGED_NOT_HOST_VERIFIED",'}|Select-Object -Last 1|ConvertFrom-Json
if(-not $taskPackage){throw 'Exact package identity receipt missing.'}
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f22c-20261021-attempt01.vsix'
if([IO.Path]::GetFullPath((Join-Path $taskRepo $taskPackage.output)) -cne [IO.Path]::GetFullPath($taskVsix)){throw 'Unexpected package path.'}
$taskVsixSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
if($taskVsixSha -cne $taskPackage.sha256 -or (Get-Item -LiteralPath $taskVsix).Length -ne $taskPackage.bytes){throw 'Package bytes differ from receipt.'}
$taskBundleSha=$taskPackage.extensionSha256
Invoke-Checked 'inspect-vsix-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'inspect-vsix-01.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha,'-InspectionName','01')
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
Invoke-Checked 'terraform-native-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-terraform-native-01.ps1'),'-CodePath',$taskCode,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-01/lite-terraform-host.js'),'-ExtensionRoot',(Join-Path $PSScriptRoot 'vsix-extracted-01/extension'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
Invoke-Checked 'current-affected-suite-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-01.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
@{status='PASS_SCOPED_CURRENT_CANDIDATE01_GATES';vsixSha256=$taskVsixSha;extensionSha256=$taskBundleSha}|ConvertTo-Json
