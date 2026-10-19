$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F19Close([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F19 source barrier failed: '+$Name)}
}
Invoke-F19Close 'stage-source-01' 'git' @('--literal-pathspecs','-c','core.autocrlf=false','add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f19-commit-allowlist-01.txt')))
Invoke-F19Close 'staged-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-source-02.cjs'),'--staged')
Invoke-F19Close 'f19-source-commit-01' 'git' @('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','feat(lite): add scoped pinned Claude Code native CLI adapter')
$taskSource=(& git rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Source revision unavailable'}
Invoke-F19Close 'source-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-source-02.cjs'),$taskSource)
Invoke-F19Close 'transition-preparation-01' 'node' @((Join-Path $PSScriptRoot 'prepare-transition-01.cjs'),$taskSource)
Invoke-F19Close 'stage-transition-01' 'git' @('--literal-pathspecs','-c','core.autocrlf=false','add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f19-transition-allowlist-01.txt')))
Invoke-F19Close 'staged-transition-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),'--staged')
Invoke-F19Close 'f19-transition-commit-01' 'git' @('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs(lite): verify F19 bytes and activate F20')
$taskTransition=(& git rev-parse HEAD).Trim();if($LASTEXITCODE -ne 0){throw 'Transition revision unavailable'}
Invoke-F19Close 'transition-byte-verification-01' 'node' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),$taskTransition)
