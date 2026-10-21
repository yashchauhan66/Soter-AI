$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Recovery stopped; raw retained: '+$Name)}
}
$taskFull=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-tests-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskCompiler=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backend-typecheck-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFull.exitCode -ne 0 -or $taskCompiler.exitCode -ne 0){throw 'Current full/compiler must pass before recovery.'}
Invoke-Checked 'retain-backend-inputs-run-03' 'node' @((Join-Path $PSScriptRoot 'retain-backend-inputs-03.cjs'))
Invoke-Checked 'backend-tests-03' 'node' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-Checked 'candidate02-gates-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'complete-candidate02-01.ps1'))
@{status='PASS_CURRENT_F22E_RECOVERY_AND_EXACT_CANDIDATE02_GATES';scope='Current full02 retained PASS, backend03 serial schedule, exact native object/closures; byte barriers pending.'}|ConvertTo-Json
