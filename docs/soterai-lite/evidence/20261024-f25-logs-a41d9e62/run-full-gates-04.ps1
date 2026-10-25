$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
Set-Location -LiteralPath $taskRepo
function Invoke-F25Gate([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-full-inputs-04.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current unit/product/build input drift.'}
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; evidence retained: '+$Name)}
}
# raw-budget-tests02 passes with intact receipt on unchanged product/unit inputs.
# readiness-tests-01 has current intact raw/receipt and11PASS; frozen product/unit inputs are unchanged.
Invoke-F25Gate 'full-tests-03' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F25Gate 'backend-typecheck-01' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-F25Gate 'backend-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F25Gate 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f25-20261024-attempt01.vsix')
& node (Join-Path $PSScriptRoot 'check-full-inputs-04.cjs')
if($LASTEXITCODE -ne 0){throw 'Input drift after serial gates.'}
exit 0
