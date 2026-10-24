$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-current-inputs-01.cjs')
 if($LASTEXITCODE -ne 0){throw 'Frozen input drift; stop before next gate.'}
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; retained: '+$Name)}
}
Invoke-Checked 'typecheck-03' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json')
Invoke-Checked 'focused-run-03' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-combined-02.ps1'),'-EvidenceName','mcp-combined-03.txt')
Invoke-Checked 'backend-typecheck-01' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-Checked 'backend-tests-01' 'node' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-Checked 'full-tests-01' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
& node (Join-Path $PSScriptRoot 'check-current-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Frozen source drift after full suite.'}
@{status='PASS_SERIAL_F22H_SOURCE_TEST_GATES';scope='Compiler/focused/backend/full only. Exact VSIX/native/byte acceptance remains pending.'}|ConvertTo-Json
exit 0
