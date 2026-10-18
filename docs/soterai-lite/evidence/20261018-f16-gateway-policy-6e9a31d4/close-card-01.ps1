$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskBase='docs/soterai-lite/evidence/20261018-f16-gateway-policy-6e9a31d4'
$taskArtifact='c7f4ed2eefcbcb9c71882f118800e2ec5c47cd3cf83a86c005c412d807d2f83a'
function Invoke-F16Evidence([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F16 serial gate failed; retained '+$Name)}
}
Invoke-F16Evidence 'finalization-launch-01' @($taskBase+'/finalize-bindings-01.cjs')
Invoke-F16Evidence 'acceptance-launch-01' @($taskBase+'/prepare-acceptance-01.cjs')
& (Join-Path $PSScriptRoot 'commit-f16-01.ps1')
if($LASTEXITCODE -ne 0){throw 'F16 source commit step failed.'}
$taskSource=(@(& git rev-parse HEAD))[0]
if($LASTEXITCODE -ne 0 -or $taskSource -cnotmatch '^[a-f0-9]{40}$'){throw 'Source revision unavailable.'}
Invoke-F16Evidence 'source-byte-verification-01' @($taskBase+'/verify-commit-01.cjs',$taskSource,$taskArtifact)
Invoke-F16Evidence 'transition-preparation-launch-01' @($taskBase+'/prepare-transition-01.cjs',$taskSource,$taskArtifact,'source-byte-verification-01.txt')
& (Join-Path $PSScriptRoot 'commit-transition-01.ps1')
if($LASTEXITCODE -ne 0){throw 'F16 transition commit step failed.'}
$taskTransition=(@(& git rev-parse HEAD))[0]
if($LASTEXITCODE -ne 0 -or $taskTransition -cnotmatch '^[a-f0-9]{40}$'){throw 'Transition revision unavailable.'}
Invoke-F16Evidence 'transition-verification-01' @($taskBase+'/verify-transition-01.cjs',$taskTransition,$taskSource,$taskArtifact)
Write-Output (@{status='PASS_F16_SOURCE_AND_TRANSITION_BYTES';source=$taskSource;transition=$taskTransition;artifact=$taskArtifact;next='F17'}|ConvertTo-Json)
