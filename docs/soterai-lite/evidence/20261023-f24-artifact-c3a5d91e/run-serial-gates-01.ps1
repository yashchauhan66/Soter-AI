$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F24Gate([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-inputs-01.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current source/test/build input drift.'}
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; evidence retained: '+$Name)}
}
Invoke-F24Gate 'typecheck-02' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F24Gate 'readiness-tests-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')
Invoke-F24Gate 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F24Gate 'backend-typecheck-01' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-F24Gate 'backend-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F24Gate 'build-native-hosts-run-01' @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-01')
Invoke-F24Gate 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f24-20261023-attempt01.vsix')
& node (Join-Path $PSScriptRoot 'check-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Input drift after current serial gates.'}
@{status='PASS_CURRENT_SERIAL_F24_COMPONENT_GATES_NATIVE_PENDING';scope='Current compiler/full/backend/native fixture build/new exact package only; actual native acceptance and byte barriers remain required.'}|ConvertTo-Json
exit 0
