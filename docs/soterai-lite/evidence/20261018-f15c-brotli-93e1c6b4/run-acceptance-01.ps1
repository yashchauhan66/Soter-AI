$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskStep in @(@{Name='bindings-launch-01';Script='finalize-bindings-01.cjs'},@{Name='acceptance-launch-01';Script='prepare-acceptance-01.cjs'})){
 & $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot $taskStep.Script)) -OutputFile (Join-Path $PSScriptRoot ($taskStep.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskStep.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F15c evidence verifier failed; retained '+$taskStep.Name)}
}
