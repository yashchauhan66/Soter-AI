$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskSource='docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/vsix-extracted-01/extension'
function Invoke-F06Host([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath powershell -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F06 actual-host failure retained: '+$Name)}
}
Invoke-F06Host 'native-host-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/run-native-01.ps1','-CodePath',$taskCode,'-HostTestsPath','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/prebuilt-host-01/lite-vault-host.js','-ExtensionRoot',$taskSource)
Invoke-F06Host 'affected-editor-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/run-affected-editor-01.ps1','-CodePath',$taskCode,'-HostTestsPath','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/prebuilt-host-05/lite-secure-editor-host.js','-ExtensionRoot',$taskSource)
Invoke-F06Host 'functional-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/run-functional-01.ps1','-CodePath',$taskCode,'-HostTestsPath','docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/privacy-host.js','-OutputRoot','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/functional','-ExtensionRoot',$taskSource)
Invoke-F06Host 'security-launch-01.txt' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/run-security-01.ps1','-CodePath',$taskCode,'-UsePrebuilt','-HostTestsPath','docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/security-host.js','-OutputRoot','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security','-ExtensionRoot',$taskSource)
