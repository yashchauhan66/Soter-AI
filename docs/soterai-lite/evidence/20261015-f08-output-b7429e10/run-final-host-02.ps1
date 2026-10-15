$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskStep in @(
 @{Name='host-prepare-02.txt';Arguments=@('docs/soterai-lite/evidence/20261015-f08-output-b7429e10/prepare-final-host-02.cjs')},
 @{Name='host-build-02.txt';Arguments=@('docs/soterai-lite/evidence/20261015-f08-output-b7429e10/build-host-02.cjs')}
)){
 & $taskRunner -FilePath node -ArgumentList $taskStep.Arguments -OutputFile (Join-Path $PSScriptRoot $taskStep.Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskStep.Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw 'Final fixture preparation failed; retain evidence.'}
}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-host-checks-02.ps1')
exit $LASTEXITCODE
