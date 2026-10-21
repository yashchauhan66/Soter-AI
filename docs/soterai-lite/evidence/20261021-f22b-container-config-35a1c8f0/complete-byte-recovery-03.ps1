$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; raw evidence retained: '+$Name)}
}
Invoke-Checked 'prepare-byte-recovery-run-03' 'node' @((Join-Path $PSScriptRoot 'prepare-byte-recovery-03.cjs'))
$taskGit=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks')
Invoke-Checked 'stage-source-run-03' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+ (Join-Path $PSScriptRoot 'f22b-commit-allowlist-02.txt'))))
Invoke-Checked 'source-staged-byte-verification-03' 'node' @((Join-Path $PSScriptRoot 'verify-source-02.cjs'),'--staged')
Invoke-Checked 'source-staged-whitespace-03' 'node' @((Join-Path $PSScriptRoot 'verify-authored-whitespace-03.cjs'))
Invoke-Checked 'f22b-source-commit-01' 'git' ($taskGit+@('commit','-m','feat(lite): add reviewed Docker and Kubernetes secret scanner (F22b)'))
$taskSource=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskSource -notmatch '^[a-f0-9]{40}$'){throw 'Exact source revision missing.'}
Invoke-Checked 'source-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-source-02.cjs'),$taskSource)
Invoke-Checked 'prepare-transition-run-02' 'node' @((Join-Path $PSScriptRoot 'prepare-transition-02.cjs'),$taskSource)
Invoke-Checked 'stage-transition-run-01' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+ (Join-Path $PSScriptRoot 'f22b-transition-allowlist-01.txt'))))
Invoke-Checked 'transition-staged-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),'--staged')
Invoke-Checked 'transition-staged-whitespace-01' 'git' ($taskGit+@('-c','core.whitespace=cr-at-eol','diff','--cached','--check'))
Invoke-Checked 'f22b-transition-commit-01' 'git' ($taskGit+@('commit','-m','docs(lite): record F22b byte barriers and activate F22c'))
$taskTransition=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskTransition -notmatch '^[a-f0-9]{40}$'){throw 'Exact transition revision missing.'}
Invoke-Checked 'transition-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),$taskTransition)
@{status='PASS_F22B_SCOPED_SOURCE_AND_TRANSITION_BYTES';source=$taskSource;transition=$taskTransition}|ConvertTo-Json
