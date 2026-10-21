$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; raw evidence retained: '+$Name)}
}
Invoke-Checked 'prepare-transition-recovery-run-02' 'node' @((Join-Path $PSScriptRoot 'prepare-transition-recovery-02.cjs'))
$taskGit=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks')
Invoke-Checked 'stage-transition-run-02' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+ (Join-Path $PSScriptRoot 'f22d-transition-allowlist-02.txt'))))
Invoke-Checked 'transition-staged-byte-verification-02' 'node' @((Join-Path $PSScriptRoot 'verify-transition-02.cjs'),'--staged')
Invoke-Checked 'transition-staged-whitespace-02' 'node' @((Join-Path $PSScriptRoot 'verify-transition-whitespace-02.cjs'))
Invoke-Checked 'f22d-transition-commit-01' 'git' ($taskGit+@('commit','-m','docs(lite): record F22d byte barriers and activate F22e'))
$taskTransition=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskTransition -notmatch '^[a-f0-9]{40}$'){throw 'Exact transition revision missing.'}
Invoke-Checked 'transition-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-02.cjs'),$taskTransition)
@{status='PASS_F22D_SOURCE_AND_TRANSITION_BYTES';transition=$taskTransition}|ConvertTo-Json
