$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Prelaunch stopped; raw retained: '+$Name)}
}
Invoke-Checked 'record-progress02-run-01' 'node' @((Join-Path $PSScriptRoot 'record-progress-02.cjs'))
Invoke-Checked 'prepare-host-tools-run-01' 'node' @((Join-Path $PSScriptRoot 'prepare-host-tools-01.cjs'))
Invoke-Checked 'verify-service-account-fixture-run-01' 'node' @((Join-Path $PSScriptRoot 'verify-service-account-fixture-01.cjs'))
Invoke-Checked 'validate-native-payloads-run-01' 'node' @('--import','tsx',(Join-Path $PSScriptRoot 'validate-native-payloads-01.cjs'))
Invoke-Checked 'build-native-hosts-run-01' 'node' @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'))
Invoke-Checked 'validate-host-fixtures-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'validate-host-fixtures-01.ps1'))
Invoke-Checked 'readiness-generation-01' 'node' @('packages/vscode-extension/scripts/generate-readiness.mjs')
@{status='PASS_PRELAUNCH_ONLY';nativeBehaviorVerified=$false}|ConvertTo-Json
