$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if(-not [String]::Equals([IO.Path]::GetFullPath((Get-Location).Path),$taskRepo,[StringComparison]::OrdinalIgnoreCase)){throw 'Run from the original workspace root.'}
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
if(-not (Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'Authorized D synthetic temp directory unavailable.'}
function Invoke-F05Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskOutput=Join-Path $PSScriptRoot $Name
 if((Test-Path -LiteralPath $taskOutput) -or (Test-Path -LiteralPath ($taskOutput+'.result.json'))){throw 'Immutable check evidence already exists; use a new attempt script.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F05 check failed: '+$Name+'; retain this attempt and correct the cause.')}
}
Invoke-F05Check 'typecheck-06.txt' 'node' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F05Check 'focused-after-03.txt' 'node' @('--import','tsx','--test','--test-concurrency=1',
 'packages/vscode-extension/src/__tests__/lite-secure-editor-model.test.ts',
 'packages/vscode-extension/src/__tests__/lite-secure-editor-recovery.test.ts',
 'packages/vscode-extension/src/__tests__/lite-secure-editor-commands.test.ts')
Invoke-F05Check 'full-tests-02.txt' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F05Check 'package-01.txt' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f05-20261014-attempt01.vsix')
Invoke-F05Check 'vsix-inspection-01.txt' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/inspect-vsix-01.ps1')
Invoke-F05Check 'host-build-01.txt' 'node' @('docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/build-host-01.cjs')
Write-Output 'Local checks completed; actual native/affected hosts, acceptance and scoped commit remain required. No F06 transition.'
