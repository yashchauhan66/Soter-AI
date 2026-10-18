$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskArtifact='c7f4ed2eefcbcb9c71882f118800e2ec5c47cd3cf83a86c005c412d807d2f83a'
function Invoke-F16Byte([string]$Name,[string[]]$Arguments,[int]$Count){
 if($Arguments.Count -ne $Count){throw 'Explicit argument count mismatch.'}
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F16 serial gate failed; retained '+$Name)}
}
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-byte-reconciliation-02.cjs'))
Invoke-F16Byte -Name 'byte-reconciliation-preparation-01' -Arguments $taskArgs -Count 1
& (Join-Path $PSScriptRoot 'commit-byte-reconciliation-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Exact byte-binding commit step failed.'}
$taskSource=(@(& git rev-parse HEAD))[0]
if($LASTEXITCODE -ne 0 -or $taskSource -cnotmatch '^[a-f0-9]{40}$'){throw 'Source revision unavailable.'}
$taskArgs=@((Join-Path $PSScriptRoot 'verify-commit-03.cjs'),$taskSource,$taskArtifact)
Invoke-F16Byte -Name 'source-byte-verification-03' -Arguments $taskArgs -Count 3
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-transition-03.cjs'),$taskSource,$taskArtifact,'source-byte-verification-03.txt')
Invoke-F16Byte -Name 'transition-preparation-launch-03' -Arguments $taskArgs -Count 4
& (Join-Path $PSScriptRoot 'commit-transition-03.ps1')
if($LASTEXITCODE -ne 0){throw 'F16 transition commit step failed.'}
$taskTransition=(@(& git rev-parse HEAD))[0]
if($LASTEXITCODE -ne 0 -or $taskTransition -cnotmatch '^[a-f0-9]{40}$'){throw 'Transition revision unavailable.'}
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-03.cjs'),$taskTransition,$taskSource,$taskArtifact)
Invoke-F16Byte -Name 'transition-verification-03' -Arguments $taskArgs -Count 4
Write-Output (@{status='PASS_F16_SOURCE_AND_TRANSITION_BYTES';implementation='e0f4bbe906950691929742017a52ab35c650fc37';source=$taskSource;transition=$taskTransition;artifact=$taskArtifact;next='F17'}|ConvertTo-Json)
