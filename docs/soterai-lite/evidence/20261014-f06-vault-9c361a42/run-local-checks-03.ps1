$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F06Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F06 check failed; preserve evidence: '+$Name)}
}
Invoke-F06Check 'artifact-prepare-02.txt' node @('docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/prepare-artifact-02.cjs')
Invoke-F06Check 'typecheck-09.txt' node @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F06Check 'focused-after-06.txt' node @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/lite-vault-plan.test.ts','packages/vscode-extension/src/__tests__/lite-vault-manager.test.ts','packages/vscode-extension/src/__tests__/lite-vault-storage.test.ts','packages/vscode-extension/src/__tests__/lite-secure-editor-model.test.ts')
Invoke-F06Check 'full-tests-03.txt' node @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F06Check 'package-02.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f06-20261015-attempt02.vsix')
Invoke-F06Check 'vsix-inspection-02.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/inspect-vsix-02.ps1')
Invoke-F06Check 'host-build-06.txt' node @('docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/build-host-06.cjs')
