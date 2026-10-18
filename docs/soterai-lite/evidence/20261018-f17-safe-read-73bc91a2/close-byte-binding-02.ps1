$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskHooks=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks'
function Invoke-F17B([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo | Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F17 byte barrier failed; retained '+$Name)}
}
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-byte-binding-02.cjs')); Invoke-F17B 'byte-binding-preparation-02' node $taskArgs
$taskArgs=@('-c','core.autocrlf=false','add','--renormalize','--','packages/vscode-extension/src/ai-boundary/readFile.ts'); Invoke-F17B 'dependency-byte-stage-02' git $taskArgs
$taskPaths=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f17-commit-allowlist-02.txt')|Where-Object{$_})
$taskArgs=@('-c','core.autocrlf=false','add','--')+$taskPaths; Invoke-F17B 'source-stage-02' git $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'verify-source-02.cjs'),'--staged'); Invoke-F17B 'staged-byte-verification-02' node $taskArgs
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'commit','-m','feat(lite): add session-bound approved safe-read MCP route'); Invoke-F17B 'f17-source-commit-01' git $taskArgs
$taskSource=(& git -c core.autocrlf=false rev-parse HEAD).Trim()
$taskArgs=@((Join-Path $PSScriptRoot 'verify-source-02.cjs'),$taskSource); Invoke-F17B 'source-byte-verification-02' node $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-transition-02.cjs'),$taskSource); Invoke-F17B 'transition-preparation-01' node $taskArgs
$taskPaths=@(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f17-transition-allowlist-01.txt')|Where-Object{$_})
$taskArgs=@('-c','core.autocrlf=false','add','--')+$taskPaths; Invoke-F17B 'transition-stage-01' git $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-02.cjs'),'--staged'); Invoke-F17B 'transition-staged-verification-01' node $taskArgs
$taskArgs=@('-c','core.autocrlf=false','-c',('core.hooksPath='+$taskHooks),'commit','-m','docs(lite): receipt F17 bytes and activate queued F18'); Invoke-F17B 'f17-transition-commit-01' git $taskArgs
$taskTransition=(& git -c core.autocrlf=false rev-parse HEAD).Trim()
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-02.cjs'),$taskTransition); Invoke-F17B 'transition-byte-verification-01' node $taskArgs
Write-Output ('F17 source '+$taskSource+' transition '+$taskTransition+' byte verified.')
