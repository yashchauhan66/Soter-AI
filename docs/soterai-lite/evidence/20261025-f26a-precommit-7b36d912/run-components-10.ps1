$ErrorActionPreference='Stop'
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskEvidence=Join-Path $taskRepo 'docs\soterai-lite\evidence\20261025-f26a-precommit-7b36d912'
$taskParsedArgs=Get-Content -LiteralPath (Join-Path $taskEvidence 'component-test-arguments-09.json') -Raw | ConvertFrom-Json
$taskArgs=@()
foreach ($taskArgument in $taskParsedArgs) { $taskArgs += [string]$taskArgument }
if ($taskArgs.Count -ne 47 -or $taskArgs[0] -ne '--import' -or $taskArgs[1] -ne 'tsx') { throw 'Individual test arguments unavailable.' }
& (Join-Path $taskRepo 'docs\soterai-lite\evidence\20261013-l0-resume-88fb9432\run-check.ps1') -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $taskEvidence 'components-combined-10.txt') -WorkingDirectory (Join-Path $taskRepo 'packages\soterai-lite')
exit $LASTEXITCODE
