$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F07Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F07 check failed; preserve evidence: '+$Name)}
}
Invoke-F07Check 'typecheck-02.txt' node @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F07Check 'focused-after-04.txt' node @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/registeredSecretMatcher.test.ts','packages/vscode-extension/src/__tests__/registeredSecretMatcher.review.test.ts','packages/vscode-extension/src/__tests__/secretMatchingIntegration.test.ts')
Invoke-F07Check 'full-tests-02.txt' node @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F07Check 'artifact-prepare-02.txt' node @('docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/prepare-final-artifact-02.cjs')
Invoke-F07Check 'package-02.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f07-20261015-attempt02.vsix')
Invoke-F07Check 'vsix-inspection-02.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/inspect-vsix-02.ps1')
