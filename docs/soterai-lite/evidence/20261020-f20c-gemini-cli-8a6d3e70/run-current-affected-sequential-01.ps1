$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20CCurrent([string]$Name,[string]$Script){
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $Script)) -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -Raw -LiteralPath ($taskOutput+'.result.json')|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Current affected gate incomplete: '+$Name)}
}
Invoke-F20CCurrent 'current-affected-cli-launch-01' 'run-affected-cli-04.ps1'
Invoke-F20CCurrent 'current-affected-ide-launch-01' 'run-ide-product-matrix-03.ps1'
Invoke-F20CCurrent 'current-retained-launch-01' 'run-current-retained-04.ps1'
Invoke-F20CCurrent 'current-affected-launch-01' 'run-current-affected-05.ps1'
