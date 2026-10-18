$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
Set-Location -LiteralPath $taskRepo
function Invoke-Receipt([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Failed gate; preserved '+$Name)}
}
Invoke-Receipt 'bindings-launch-01' @((Join-Path $PSScriptRoot 'finalize-bindings-01.cjs'))
Invoke-Receipt 'acceptance-launch-01' @((Join-Path $PSScriptRoot 'prepare-acceptance-01.cjs'))
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'commit-f15h-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Source commit incomplete; retain index.'}
$taskSource=(& git rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskSource -cnotmatch '^[a-f0-9]{40}$'){throw 'Source revision unavailable.'}
$taskAcceptance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f15h-acceptance-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskSha=$taskAcceptance.artifact.sha256
Invoke-Receipt 'source-verification-01' @((Join-Path $PSScriptRoot 'verify-commit-01.cjs'),$taskSource,$taskSha)
Invoke-Receipt 'transition-preparation-launch-01' @((Join-Path $PSScriptRoot 'prepare-parent-transition-01.cjs'),$taskSource,$taskSha)
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'commit-transition-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Separate transition commit incomplete; next production withheld.'}
$taskTransition=(& git rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $taskTransition -cnotmatch '^[a-f0-9]{40}$'){throw 'Transition revision unavailable.'}
Invoke-Receipt 'transition-verification-01' @((Join-Path $PSScriptRoot 'verify-transition-01.cjs'),$taskTransition,$taskSource,$taskSha)
Invoke-Receipt 'parent-completion-launch-01' @((Join-Path $PSScriptRoot 'finalize-parent-01.cjs'),$taskTransition,$taskSource,$taskSha)
Write-Output ('F15h complete source '+$taskSource+' separate transition '+$taskTransition+' exact VSIX '+$taskSha)
