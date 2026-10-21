$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Correction/prelaunch stopped; raw retained: '+$Name)}
}
# Correction applied after retaining the exact failed parser; no duplicate mutation.
Invoke-Checked 'review-escaped-residual-after-03' 'node' @('--import','tsx',(Join-Path $PSScriptRoot 'review-escaped-residual-01.cjs'))
Invoke-Checked 'service-account-plan-after-04' 'node' @('--import','tsx','--test','packages/vscode-extension/src/__tests__/serviceAccountSecretPlan.test.ts')
$taskFocused=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'service-account-combined-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
Invoke-Checked 'service-account-combined-03' 'node' @($taskFocused.arguments)
Invoke-Checked 'record-progress04-run-01' 'node' @((Join-Path $PSScriptRoot 'record-progress-04.cjs'))
Invoke-Checked 'verify-service-account-fixture-run-02' 'node' @((Join-Path $PSScriptRoot 'verify-service-account-fixture-02.cjs'))
Invoke-Checked 'validate-native-payloads-run-02' 'node' @('--import','tsx',(Join-Path $PSScriptRoot 'validate-native-payloads-02.cjs'))
Invoke-Checked 'build-native-hosts-run-02' 'node' @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-02')
Invoke-Checked 'validate-host-fixtures-run-02' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'validate-host-fixtures-02.ps1'))
@{status='PASS_CURRENT_CORRECTION_AND_PRELAUNCH_ONLY';nativeBehaviorVerified=$false}|ConvertTo-Json
