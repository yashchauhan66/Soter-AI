$ErrorActionPreference='Stop'
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskEvidence=Join-Path $taskRepo 'docs\soterai-lite\evidence\20261025-f26a-precommit-7b36d912'
$taskRunner=Join-Path $taskRepo 'docs\soterai-lite\evidence\20261013-l0-resume-88fb9432\run-check.ps1'
$taskPrior=Get-Content -LiteralPath (Join-Path $taskEvidence 'components-combined-07.txt.result.json') -Raw | ConvertFrom-Json
$taskArgs=@($taskPrior.arguments)+@('../vscode-extension/src/__tests__/checkedHookFile.test.ts','../vscode-extension/src/__tests__/checkedHookFileLinks.review.test.ts','../vscode-extension/src/__tests__/checkedHookFileStage.review.test.ts','../vscode-extension/src/__tests__/preCommitHookTransaction.test.ts')
& $taskRunner -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $taskEvidence 'components-combined-08.txt') -WorkingDirectory (Join-Path $taskRepo 'packages\soterai-lite')
