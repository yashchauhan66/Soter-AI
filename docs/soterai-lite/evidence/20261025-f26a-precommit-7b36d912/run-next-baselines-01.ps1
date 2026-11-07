$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskCase in @('hookIndexSnapshot','preCommitFinalGuard.review','preCommitHookText')) {
  & $taskRunner -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1',('../vscode-extension/src/__tests__/'+$taskCase+'.test.ts')) -OutputFile (Join-Path $PSScriptRoot ($taskCase+'-baseline-01.txt')) -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
  $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskCase+'-baseline-01.txt.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
  if($taskReceipt.exitCode -ne 1){throw 'Expected before-production/correction baseline exit1; inspect retained output.'}
}
