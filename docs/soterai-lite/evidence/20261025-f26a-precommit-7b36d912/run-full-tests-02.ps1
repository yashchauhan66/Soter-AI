$ErrorActionPreference='Stop'
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskEvidence=Join-Path $taskRepo 'docs\soterai-lite\evidence\20261025-f26a-precommit-7b36d912'
$taskInputFile=Join-Path $taskEvidence 'full-inputs-02.json'
$taskProof=Get-Content -LiteralPath $taskInputFile -Raw | ConvertFrom-Json
foreach ($taskInput in $taskProof.files) {
 $taskFile=Join-Path $taskRepo $taskInput.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw ('Frozen full input changed: '+$taskInput.path)}
}
$taskProcess=Get-Process -Id $PID
@{status='STARTED_NOT_COMPLETED';observedAt=[DateTime]::UtcNow.ToString('o');pid=$PID;startUtc=$taskProcess.StartTime.ToUniversalTime().ToString('o');inputSha256=(Get-FileHash -LiteralPath $taskInputFile -Algorithm SHA256).Hash.ToLowerInvariant();fileCount=$taskProof.fileCount;signalsRequested=0} | ConvertTo-Json -Depth 5 | Out-File -LiteralPath (Join-Path $taskEvidence 'full-tests-start-02.json') -Encoding utf8 -NoClobber
& (Join-Path $taskRepo 'docs\soterai-lite\evidence\20261013-l0-resume-88fb9432\run-check.ps1') -FilePath node -ArgumentList @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') -OutputFile (Join-Path $taskEvidence 'full-tests-02.txt') -WorkingDirectory (Join-Path $taskRepo 'packages\soterai-lite')
exit $LASTEXITCODE
