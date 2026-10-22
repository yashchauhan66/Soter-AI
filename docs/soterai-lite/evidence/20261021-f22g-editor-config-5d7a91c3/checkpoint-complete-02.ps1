$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Unfinished checkpoint stopped; raw retained: '+$Name)}
}
# Root must finish ACTIVE/INCOMPLETE ledger+queue wording before this wrapper.
# Record02 requires actual failure finalization and rechecks all four stable streams.
Invoke-Checked 'checkpoint-record-run-02' 'node' @((Join-Path $PSScriptRoot 'checkpoint-record-02.cjs'))
Invoke-Checked 'snapshot-execution-run-02' 'node' @((Join-Path $PSScriptRoot 'snapshot-execution-03.cjs'))
Invoke-Checked 'checkpoint-index-run-02' 'node' @((Join-Path $PSScriptRoot 'checkpoint-index-02.cjs'))
$taskGit=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks')
Invoke-Checked 'checkpoint-stage-run-02' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'checkpoint-commit-allowlist-02.txt'))))
Invoke-Checked 'checkpoint-staged-byte-verification-02' 'node' @((Join-Path $PSScriptRoot 'checkpoint-verify-02.cjs'),'--staged')
Invoke-Checked 'checkpoint-staged-whitespace-02' 'node' @((Join-Path $PSScriptRoot 'checkpoint-authored-whitespace-02.cjs'))
Invoke-Checked 'checkpoint-local-commit-02' 'git' ($taskGit+@('commit','-m','wip(lite): preserve unfinished F22g and failed native evidence checkpoint'))
$taskRevision=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskRevision -notmatch '^[a-f0-9]{40}$'){throw 'Exact checkpoint revision missing.'}
Invoke-Checked 'checkpoint-byte-verification-02' 'node' @((Join-Path $PSScriptRoot 'checkpoint-verify-02.cjs'),$taskRevision)
@{status='PASS_CHECKPOINT_BYTES_ONLY';revision=$taskRevision;feature='F22g';featureStatus='ACTIVE';completion='INCOMPLETE';acceptance='NOT_GRANTED';nextFeature='NOT_STARTED';resume='Old normal acceptance/index/source helpers parent-bound to91f5820 are stale; rebase on exact checkpoint revision before eventual final acceptance. No further host retry authorized.'}|ConvertTo-Json
