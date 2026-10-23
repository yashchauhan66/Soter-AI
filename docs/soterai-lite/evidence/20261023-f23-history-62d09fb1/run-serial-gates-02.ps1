$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F23Gate([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current source/test/build input drift.'}
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; evidence retained: '+$Name)}
}
Invoke-F23Gate 'readiness-tests-02' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')
Invoke-F23Gate 'full-tests-02' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F23Gate 'backend-typecheck-01' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-F23Gate 'backend-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F23Gate 'build-native-hosts-run-01' @((Join-Path $PSScriptRoot 'build-native-hosts-02.cjs'),'prebuilt-native-hosts-02')
& node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
if($LASTEXITCODE -ne 0){throw 'Input drift after current serial checks.'}
@{status='PASS_CURRENT_SERIAL_F23';scope='Current compiler/full/backend/native driver build; exact VSIX/native acceptance still pending.'}|ConvertTo-Json
exit 0
