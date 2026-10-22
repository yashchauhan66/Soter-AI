$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Custody([string]$Name,[string]$Program,[string[]]$Arguments){
 $taskRaw=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskRaw -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Custody receipt stopped; evidence retained: '+$Name)}
}
$taskTool=Join-Path $PSScriptRoot 'checkpoint-custody-01.cjs'
Invoke-Custody 'checkpoint-receipt-prepare-run-01' 'node' @($taskTool,'--prepare')
$taskGit=@('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks')
Invoke-Custody 'checkpoint-receipt-stage-run-01' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'checkpoint-receipt-allowlist-01.txt'))))
Invoke-Custody 'checkpoint-receipt-staged-verification-01' 'node' @($taskTool,'--staged')
Invoke-Custody 'checkpoint-receipt-commit-run-01' 'git' ($taskGit+@('commit','-m','docs(lite): retain active F22g checkpoint proof and native blockers'))
$taskRevision=(& git -C $taskRepo rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskRevision -notmatch '^[a-f0-9]{40}$'){throw 'Exact custody commit missing.'}
Invoke-Custody 'checkpoint-receipt-byte-verification-01' 'node' @($taskTool,$taskRevision)
