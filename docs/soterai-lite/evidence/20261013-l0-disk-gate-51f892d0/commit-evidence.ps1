$taskOperationLog = [System.Collections.Generic.List[string]]::new()
$taskOperationLog.Add('COMMAND: git -c core.autocrlf=false add -- docs/soterai-lite')
$taskAddOutput = & git -c core.autocrlf=false add -- docs/soterai-lite 2>&1
$taskAddExit = $LASTEXITCODE
foreach ($taskLine in $taskAddOutput) { $taskOperationLog.Add($taskLine.ToString()) }
$taskOperationLog.Add("EXIT: $taskAddExit")
if ($taskAddExit -ne 0) {
    $taskOperationLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
    exit $taskAddExit
}
$taskOperationLog.Add('COMMAND: git diff --cached --name-only')
$taskStagedFiles = @(& git diff --cached --name-only)
$taskStagedExit = $LASTEXITCODE
foreach ($taskLine in $taskStagedFiles) { $taskOperationLog.Add($taskLine) }
$taskOperationLog.Add("EXIT: $taskStagedExit")
if ($taskStagedExit -ne 0 -or $taskStagedFiles.Count -eq 0 -or @($taskStagedFiles | Where-Object { -not $_.StartsWith('docs/soterai-lite/') }).Count -gt 0) {
    $taskOperationLog.Add('FAIL: unexpected staged files or no files; no commit attempted.')
    $taskOperationLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
    exit 1
}
$taskOperationLog.Add('COMMAND: git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "docs(soterai-lite): record failed L0 disk gate and stop"')
$taskCommitOutput = & git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(soterai-lite): record failed L0 disk gate and stop' 2>&1
$taskCommitExit = $LASTEXITCODE
foreach ($taskLine in $taskCommitOutput) { $taskOperationLog.Add($taskLine.ToString()) }
$taskOperationLog.Add("EXIT: $taskCommitExit")
$taskOperationLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
$taskOperationLog
exit $taskCommitExit
