$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20BMetadata([string]$Name,[string]$File,[string[]]$Arguments){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('Metadata barrier failed: '+$Name)}
}
$taskHelper=Join-Path $PSScriptRoot 'finish-completion-metadata-01.cjs'
Invoke-F20BMetadata 'completion-metadata-prepare-01' 'node' @($taskHelper,'--prepare')
Invoke-F20BMetadata 'completion-metadata-stage-01' 'git' @('--literal-pathspecs','-c','core.autocrlf=false','add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f20b-completion-metadata-allowlist-01.txt')))
Invoke-F20BMetadata 'completion-metadata-staged-01' 'node' @($taskHelper,'--staged')
Invoke-F20BMetadata 'f20b-completion-metadata-commit-01' 'git' @('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs(lite): reconcile completed IDE gate and authorized fixture evidence')
$taskRevision=(& git rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Metadata revision missing'}
Invoke-F20BMetadata 'completion-metadata-byte-verification-01' 'node' @($taskHelper,$taskRevision)
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f20b-completion-metadata-byte-verification-01.json') -TotalCount 10
