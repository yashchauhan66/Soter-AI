$taskPaths = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'checkpoint-allowlist.txt') -Encoding utf8)
$taskPaths += @(
    'docs/soterai-lite/inputs.json',
    'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/user-waiver.json',
    'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-allowlist.txt',
    'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-files.json',
    'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/checkpoint-source.ps1'
)
$taskPaths = @($taskPaths | Sort-Object -Unique)
if (@($taskPaths | Where-Object {$_ -match '(^|/)\.env|(^|/)(credentials|cookies)|\.(pem|key|pfx|p12)$'}).Count -ne 0) { throw 'Sensitive path in checkpoint refused.' }
$taskLog = [System.Collections.Generic.List[string]]::new()
$taskLog.Add('COMMAND: git -c core.autocrlf=false add -- ' + ($taskPaths -join ' '))
$taskOutput = & git -c core.autocrlf=false add -- @taskPaths 2>&1
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskOutput) { $taskLog.Add($taskLine.ToString()) }
if ($taskExit -ne 0) { throw 'Checkpoint staging failed.' }
$taskStaged = @(& git diff --cached --name-only)
if ($LASTEXITCODE -ne 0 -or @(Compare-Object -ReferenceObject $taskPaths -DifferenceObject $taskStaged).Count -ne 0) { throw 'Staged files differ from checkpoint allowlist.' }
$taskLog.Add("STAGED PATH COUNT: $($taskStaged.Count)")
$taskLog.Add('COMMAND: git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m "chore(soterai-lite): checkpoint existing privacy sources before split"')
$taskOutput = & git -c core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks commit -m 'chore(soterai-lite): checkpoint existing privacy sources before split' 2>&1
$taskExit = $LASTEXITCODE
foreach ($taskLine in $taskOutput) { $taskLog.Add($taskLine.ToString()) }
$taskLog.Add("EXIT: $taskExit")
$taskLog | Out-File -LiteralPath (Join-Path $PSScriptRoot 'checkpoint-commit-01.txt') -Encoding utf8 -NoClobber
$taskLog
exit $taskExit
