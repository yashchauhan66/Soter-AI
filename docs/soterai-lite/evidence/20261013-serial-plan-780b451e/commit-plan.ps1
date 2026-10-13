$taskPaths = @(
    'docs/soterai-lite/ledger.md',
    'docs/soterai-lite/IMPLEMENTATION-PLAN.md',
    'docs/soterai-lite/FEATURE-QUEUE.json',
    'docs/soterai-lite/evidence/20261013-serial-plan-780b451e/check-plan.ps1',
    'docs/soterai-lite/evidence/20261013-serial-plan-780b451e/planning-integrity.json',
    'docs/soterai-lite/evidence/20261013-serial-plan-780b451e/plan-review.md',
    'docs/soterai-lite/evidence/20261013-serial-plan-780b451e/plan-edit-attempt-01.json',
    'docs/soterai-lite/evidence/20261013-serial-plan-780b451e/commit-plan.ps1',
    'docs/soterai-lite/evidence-index-20261013-serial-plan.json'
)
$taskLog = [System.Collections.Generic.List[string]]::new()
$taskLog.Add('COMMAND: git -c core.autocrlf=false add -- ' + ($taskPaths -join ' '))
$taskOutput = & git -c core.autocrlf=false add -- @taskPaths 2>&1
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskOutput) { $taskLog.Add($taskLine.ToString()) }
$taskLog.Add("EXIT: $taskExit")
if ($taskExit -ne 0) {
    $taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
    exit $taskExit
}
$taskLog.Add('COMMAND: git diff --cached --name-only')
$taskStaged = @(& git diff --cached --name-only)
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskStaged) { $taskLog.Add($taskLine) }
if ($taskExit -ne 0 -or @(Compare-Object -ReferenceObject $taskPaths -DifferenceObject $taskStaged).Count -ne 0) {
    $taskLog.Add('FAIL: staged files differ from the planning allowlist; no commit attempted.')
    $taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
    exit 1
}
$taskLog.Add('COMMAND: git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "docs(soterai-lite): plan strict sequential feature completion"')
$taskOutput = & git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(soterai-lite): plan strict sequential feature completion' 2>&1
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskOutput) { $taskLog.Add($taskLine.ToString()) }
$taskLog.Add("EXIT: $taskExit")
$taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
$taskLog
exit $taskExit
