$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20BCheck([string]$Label,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 $taskOutput=Join-Path $PSScriptRoot ($Label+'.txt')
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Required current check incomplete: '+$Label)}
}
Invoke-F20BCheck 'combined-after-02' 'node' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/codex*.test.ts','packages/vscode-extension/src/__tests__/command-palette-hygiene.test.ts','packages/vscode-extension/src/__tests__/readme-accuracy.test.ts','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')
Invoke-F20BCheck 'typecheck-02' 'node' @('node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json')
Invoke-F20BCheck 'package-03' 'node' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f20b-20261020-attempt03.vsix')
$taskBuild=Get-Content -LiteralPath (Join-Path $taskRepo 'packages/soterai-lite/dist/build-receipt.json') -Raw|ConvertFrom-Json
$taskPackage=Get-Content -LiteralPath (Join-Path $taskRepo ('packages/soterai-lite/'+$taskBuild.attempt+'/package-receipt.json')) -Raw|ConvertFrom-Json
Invoke-F20BCheck 'inspection-02' 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'inspect-vsix-01.ps1'),'-VsixPath',(Join-Path $taskRepo $taskPackage.output),'-ExpectedVsixSha256',$taskPackage.sha256,'-ExpectedBundleSha256',$taskPackage.extensionSha256,'-InspectionName','02')
Invoke-F20BCheck 'full-tests-02' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
# Earlier successful fixtures copied byte-for-byte; only evidence pointers use current inspection02.
Invoke-F20BCheck 'current-affected-cli-launch-01' 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-affected-cli-02.ps1'))
Invoke-F20BCheck 'current-retained-launch-01' 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-retained-02.ps1'))
Invoke-F20BCheck 'current-affected-launch-01' 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-02.ps1'))
@{status='AUTOMATED_AFFECTED_GATES_PASSED_IDE_PRODUCT_NATIVE_GATE_STILL_INCOMPLETE';feature='F20B';scope='No additional IDE fixture improvement. Exact current previous CLI20/retained106/functional10/security17 only. F20B is not DONE and no next card authorized by these results.';observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Out-File -LiteralPath (Join-Path $PSScriptRoot 'final-automated-gates-01.json') -Encoding utf8 -NoClobber
