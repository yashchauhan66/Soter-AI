$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskRow in @(
    @{test='mcpSecretPlan.test.ts';name='mcp-plan-baseline-01.txt'},
    @{test='mcpScanner.test.ts';name='mcp-integration-baseline-01.txt'},
    @{test='mcpScannerCommands.test.ts';name='mcp-commands-baseline-01.txt'}
)) {
    $taskTest='../vscode-extension/src/__tests__/'+$taskRow.test
    & $taskRunner -FilePath 'node' -ArgumentList @('--import','tsx','--test','--test-concurrency=1',$taskTest) -OutputFile (Join-Path $PSScriptRoot $taskRow.name) -WorkingDirectory (Join-Path $taskRepo 'packages/soterai-lite')
    if($LASTEXITCODE -ne 1){throw 'Expected missing-implementation baseline exit1 absent.'}
}
exit 0
