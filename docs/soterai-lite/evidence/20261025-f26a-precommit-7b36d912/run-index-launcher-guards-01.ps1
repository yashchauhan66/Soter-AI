$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskCases=@('preCommitProtocol','preCommitSizes','preCommitScan','preCommitGitProcess','preCommitFinalGuard.review','hookIndexSnapshot','checkedHookIndex','preCommitHookText')
$taskArgs=@('--import','tsx','--test','--test-concurrency=1')+@($taskCases|ForEach-Object {'../vscode-extension/src/__tests__/'+$_+'.test.ts'})
& $taskRunner -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot 'index-launcher-guards-01.txt') -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
