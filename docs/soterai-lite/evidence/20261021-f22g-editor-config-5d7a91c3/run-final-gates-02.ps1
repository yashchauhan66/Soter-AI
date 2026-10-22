$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; raw evidence retained: '+$Name)}
}
$taskFocused=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'editor-combined-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFocused.exitCode -ne 0 -or $taskFocused.file -cne 'node'){throw 'Original current focused receipt required.'}
# Current focused358 already passed; full suite below includes the same current cases.
Invoke-Checked 'full-tests-01' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-Checked 'backend-typecheck-01' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-Checked 'backend-tests-01' 'node' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-Checked 'candidate01-gates-run-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'complete-candidate01-02.ps1'))
@{status='PASS_CURRENT_F22G_REGRESSION_AND_EXACT_CANDIDATE_GATES';scope='Scoped static grammar and scripted synthetic native workflows only; evidence/byte barriers still pending.'}|ConvertTo-Json
