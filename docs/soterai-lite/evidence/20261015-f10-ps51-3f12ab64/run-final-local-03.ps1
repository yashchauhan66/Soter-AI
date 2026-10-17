$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
function Invoke-F10Local([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F10 local check failed; retained '+$Name)}
}
$taskTests=@(Get-ChildItem -LiteralPath (Join-Path $taskRepo 'packages/vscode-extension/src/__tests__') -File | Where-Object {$_.Name -match '^(checkedPowerShell|powerShell51|checkedGitMetadata|managedOutputFilter).*\.test\.ts$'} | Sort-Object Name | ForEach-Object {$_.FullName})
Invoke-F10Local 'final-focused-03' (@('--import','tsx','--test','--test-concurrency=1')+$taskTests+@((Join-Path $taskRepo 'packages/vscode-extension/src/__tests__/extension.test.ts')))
Invoke-F10Local 'typecheck-07' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F10Local 'full-tests-03' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F10Local 'package-02' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f10-20261017-attempt01.vsix')
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f10-20261017-attempt01.vsix'
$taskVsixSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskBundleSha=(Get-FileHash -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
& (Join-Path $PSScriptRoot 'inspect-vsix-03.ps1') -VsixPath $taskVsix -ExpectedVsixSha256 $taskVsixSha -ExpectedBundleSha256 $taskBundleSha -InspectionName 02
Write-Output ('F10 local build/inspection complete: '+$taskVsixSha+' runtime '+$taskBundleSha)
