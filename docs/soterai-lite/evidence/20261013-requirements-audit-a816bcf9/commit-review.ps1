$taskAllowedPaths = @(
    'docs/soterai-lite/ledger.md',
    'docs/soterai-lite/REQUIREMENTS-AUDIT-20261013.md',
    'docs/soterai-lite/evidence/20261013-requirements-audit-a816bcf9/audit-evidence.ps1',
    'docs/soterai-lite/evidence/20261013-requirements-audit-a816bcf9/audit-raw-metadata.json',
    'docs/soterai-lite/evidence/20261013-requirements-audit-a816bcf9/commit-review.ps1',
    'docs/soterai-lite/evidence-index-20261013-requirements-review.json'
)
$taskLog = [System.Collections.Generic.List[string]]::new()
$taskLog.Add('COMMAND: git -c core.autocrlf=false add -- ' + ($taskAllowedPaths -join ' '))
$taskOutput = & git -c core.autocrlf=false add -- @taskAllowedPaths 2>&1
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
if ($taskExit -ne 0 -or @(Compare-Object -ReferenceObject $taskAllowedPaths -DifferenceObject $taskStaged).Count -ne 0) {
    $taskLog.Add('FAIL: staged paths do not match review allowlist; no commit attempted.')
    $taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
    exit 1
}
$taskLog.Add('COMMAND: git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "docs(soterai-lite): audit five user requirements and install gaps"')
$taskOutput = & git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'docs(soterai-lite): audit five user requirements and install gaps' 2>&1
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskOutput) { $taskLog.Add($taskLine.ToString()) }
$taskLog.Add("EXIT: $taskExit")
$taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'commit-result.txt') -Encoding utf8 -NoClobber
$taskLog
exit $taskExit
