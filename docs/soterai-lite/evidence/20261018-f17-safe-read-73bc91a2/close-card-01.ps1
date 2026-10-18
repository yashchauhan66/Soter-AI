$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskHooks=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks'
function Invoke-F17Close([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F17 serial barrier failed; retained '+$Name)}
}
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-acceptance-01.cjs'))
Invoke-F17Close 'acceptance-preparation-01' node $taskArgs
$taskPaths=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f17-commit-allowlist-01.txt')|Where-Object{$_})
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'add','--')+$taskPaths
Invoke-F17Close 'source-stage-01' git $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'verify-source-01.cjs'),'--staged')
Invoke-F17Close 'staged-byte-verification-01' node $taskArgs
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'commit','-m','feat(lite): add session-bound approved safe-read MCP route')
Invoke-F17Close 'f17-source-commit-01' git $taskArgs
$taskSource=(& git -c core.autocrlf=false rev-parse HEAD).Trim()
$taskArgs=@((Join-Path $PSScriptRoot 'verify-source-01.cjs'),$taskSource)
if($taskArgs.Count -ne 2){throw 'Source proof argv shape invalid'}
Invoke-F17Close 'source-byte-verification-01' node $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-transition-01.cjs'),$taskSource)
Invoke-F17Close 'transition-preparation-01' node $taskArgs
$taskPaths=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f17-transition-allowlist-01.txt')|Where-Object{$_})
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'add','--')+$taskPaths
Invoke-F17Close 'transition-stage-01' git $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),'--staged')
Invoke-F17Close 'transition-staged-verification-01' node $taskArgs
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'commit','-m','docs(lite): receipt F17 bytes and activate queued F18')
Invoke-F17Close 'f17-transition-commit-01' git $taskArgs
$taskTransition=(& git -c core.autocrlf=false rev-parse HEAD).Trim()
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),$taskTransition)
if($taskArgs.Count -ne 2){throw 'Transition proof argv shape invalid'}
Invoke-F17Close 'transition-byte-verification-01' node $taskArgs
Write-Output ('F17 source '+$taskSource+' transition '+$taskTransition+' byte verified.')
