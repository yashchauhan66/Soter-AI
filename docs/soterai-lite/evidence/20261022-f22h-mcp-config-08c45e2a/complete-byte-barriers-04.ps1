$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Byte barrier stopped; raw retained: '+$Name)}
}
Invoke-Checked 'native-closure-run-01' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'confirm-owned-runner-exit-05.ps1'),'-Kind','native')
Invoke-Checked 'frozen-membership-run-01' 'node' @((Join-Path $PSScriptRoot 'check-frozen-membership-06.cjs'))
Invoke-Checked 'snapshot-execution-run-01' 'node' @((Join-Path $PSScriptRoot 'snapshot-execution-01.cjs'))
Invoke-Checked 'prepare-acceptance-run-01' 'node' @((Join-Path $PSScriptRoot 'prepare-acceptance-06.cjs'))
Invoke-Checked 'prepare-index-run-01' 'node' @((Join-Path $PSScriptRoot 'prepare-index-02.cjs'))
$taskGit=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks')
Invoke-Checked 'stage-source-run-01' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f22h-commit-allowlist-01.txt'))))
Invoke-Checked 'source-staged-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-source-01.cjs'),'--staged')
Invoke-Checked 'source-staged-whitespace-01' 'node' @((Join-Path $PSScriptRoot 'verify-authored-whitespace-04.cjs'))
Invoke-Checked 'f22h-source-commit-01' 'git' ($taskGit+@('commit','-m','test(lite): verify MCP scanner native custody and cleanup (F22h)'))
$taskSource=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskSource -notmatch '^[a-f0-9]{40}$'){throw 'Exact source revision missing.'}
Invoke-Checked 'source-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-source-01.cjs'),$taskSource)
Invoke-Checked 'prepare-transition-run-01' 'node' @((Join-Path $PSScriptRoot 'prepare-transition-01.cjs'),$taskSource)
Invoke-Checked 'stage-transition-run-01' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f22h-transition-allowlist-01.txt'))))
Invoke-Checked 'transition-staged-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),'--staged')
Invoke-Checked 'transition-staged-whitespace-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-whitespace-01.cjs'))
Invoke-Checked 'f22h-transition-commit-01' 'git' ($taskGit+@('commit','-m','docs(lite): record F22h byte barriers and activate F23'))
$taskTransition=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskTransition -notmatch '^[a-f0-9]{40}$'){throw 'Exact transition revision missing.'}
Invoke-Checked 'transition-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),$taskTransition)
@{status='PASS_F22H_PARENT_F22_SOURCE_AND_TRANSITION_BYTES';source=$taskSource;transition=$taskTransition;next='F23'}|ConvertTo-Json
exit 0
