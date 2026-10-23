$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-frozen-membership-03.cjs')
 if($LASTEXITCODE -ne 0){throw 'Frozen input drift; stop before retry gate.'}
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Retry gate failed; raw retained: '+$Name)}
}
$taskRebuild=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'guard-core-rebuild-comparison-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskRebuild.changed -ne 0 -or $taskRebuild.files -ne 212){throw 'Fresh focused/backend checks needed for changed runtime bytes.'}
Invoke-Checked 'full-failed-controls-after-01' 'node' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/codexIdeArtifact.test.ts','packages/vscode-extension/src/__tests__/phase2/p2-harness.test.ts')
Invoke-Checked 'attributes-check-01' 'git' @('check-attr','text','--','docs/soterai-lite/evidence/20261022-f22h-mcp-config-08c45e2a/source-inputs-02.json','packages/vscode-extension/src/__tests__/fixtures/codex-ide-26.51007.21434-manifest.json','packages/vscode-extension/src/__tests__/fixtures/codex-ide-26.51007.21434-runtime-package.json')
$taskAttrs=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'attributes-check-01.txt') -Encoding UTF8|Where-Object{$_ -match ': text: '})
if($taskAttrs.Count -ne 3 -or @($taskAttrs|Where-Object{$_ -notmatch ': text: unset$'}).Count -ne 0){throw 'Exact byte-retention attributes not effective.'}
Invoke-Checked 'full-tests-02' 'node' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
& node (Join-Path $PSScriptRoot 'check-frozen-membership-03.cjs')
if($LASTEXITCODE -ne 0){throw 'Frozen input drift after current full suite.'}
@{status='PASS_CURRENT_FULL_AFTER_EXACT_FIXTURE_REPAIR_REAL_BYTE_IDENTICAL_BUILD';scope='Compiler03/focused419/backend143PASS1SKIP source/runtime bytes unchanged; targeted repaired gates/currentfull pass. Exact VSIX/native/byte acceptance remains pending.'}|ConvertTo-Json
exit 0
