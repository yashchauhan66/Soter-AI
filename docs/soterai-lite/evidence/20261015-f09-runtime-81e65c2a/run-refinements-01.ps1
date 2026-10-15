$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskCheck in @(
 @{Name='prepare-refinements-01.txt';Script='docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-refinements-01.cjs'},
 @{Name='metadata-sync-02.txt';Script='docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-metadata-02.cjs'},
 @{Name='generate-readiness-02.txt';Script='packages/vscode-extension/scripts/generate-readiness.mjs'})){
 & $taskRunner -FilePath node -ArgumentList @($taskCheck.Script) -OutputFile (Join-Path $PSScriptRoot $taskCheck.Name) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskCheck.Name+'.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Refinement preparation failed: '+$taskCheck.Name)}
}
