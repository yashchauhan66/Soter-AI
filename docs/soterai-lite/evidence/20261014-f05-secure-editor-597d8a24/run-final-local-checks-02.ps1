$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if(-not [String]::Equals([IO.Path]::GetFullPath((Get-Location).Path),$taskRepo,[StringComparison]::OrdinalIgnoreCase)){throw 'Run from the original workspace root.'}
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F05Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskOutput=Join-Path $PSScriptRoot $Name
 if((Test-Path -LiteralPath $taskOutput) -or (Test-Path -LiteralPath ($taskOutput+'.result.json'))){throw 'Immutable check evidence already exists; use a new attempt.'}
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F05 check failed: '+$Name+'; retain the attempt.')}
}
# Production/typecheck/focused inputs are unchanged; full02's sole failure is generated metadata drift.
Invoke-F05Check 'generate-readiness-02.txt' 'node' @('packages/vscode-extension/scripts/generate-readiness.mjs')
Invoke-F05Check 'full-tests-03.txt' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F05Check 'package-01.txt' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f05-20261014-attempt01.vsix')
Invoke-F05Check 'vsix-inspection-01.txt' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File','docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/inspect-vsix-01.ps1')
Invoke-F05Check 'host-build-01.txt' 'node' @('docs/soterai-lite/evidence/20261014-f05-secure-editor-597d8a24/build-host-01.cjs')
Write-Output 'Local checks completed; native/affected hosts and scoped commit remain required.'
