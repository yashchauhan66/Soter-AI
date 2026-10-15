$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-FinalLocal([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Final local check failed; retain result: '+$Name)}
}
$taskFocused=@('--import','tsx','--test','--test-concurrency=1')
foreach($taskFile in @('vaultAppDescriptor.test.ts','vaultAppJob.test.ts','vaultAppJob.review.test.ts','vaultAppJob.short.test.ts','vaultRuntimeLease.test.ts','vaultRuntimeCoordinator.test.ts','vaultRuntimeSurfaces.test.ts','vaultRuntimeSurfaces.review.test.ts','vaultRuntimeOwnership.review.test.ts','vaultRuntimePolicy.review.test.ts')){
 $taskFocused+=('packages/vscode-extension/src/__tests__/'+$taskFile)
}
Invoke-FinalLocal 'focused-after-05.txt' $taskFocused
Invoke-FinalLocal 'typecheck-04.txt' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-FinalLocal 'full-tests-02.txt' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
