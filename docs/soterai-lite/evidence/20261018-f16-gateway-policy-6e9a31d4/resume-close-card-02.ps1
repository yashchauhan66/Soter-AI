$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
Set-Location -LiteralPath $taskRepo
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskSource='e0f4bbe906950691929742017a52ab35c650fc37'
$taskArtifact='c7f4ed2eefcbcb9c71882f118800e2ec5c47cd3cf83a86c005c412d807d2f83a'
function Invoke-F16Resume([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F16 serial gate failed; retained '+$Name)}
}
$taskArgs=@((Join-Path $PSScriptRoot 'verify-commit-01.cjs'),$taskSource,$taskArtifact)
if($taskArgs.Count -ne 3){throw 'Three explicit source-verifier arguments required.'}
Invoke-F16Resume -Name 'source-byte-verification-02' -Arguments $taskArgs
$taskArgs=@((Join-Path $PSScriptRoot 'prepare-transition-02.cjs'),$taskSource,$taskArtifact,'source-byte-verification-02.txt')
if($taskArgs.Count -ne 4){throw 'Four explicit transition-preparation arguments required.'}
Invoke-F16Resume -Name 'transition-preparation-launch-02' -Arguments $taskArgs
& (Join-Path $PSScriptRoot 'commit-transition-02.ps1')
if($LASTEXITCODE -ne 0){throw 'F16 transition commit step failed.'}
$taskTransition=(@(& git rev-parse HEAD))[0]
if($LASTEXITCODE -ne 0 -or $taskTransition -cnotmatch '^[a-f0-9]{40}$'){throw 'Transition revision unavailable.'}
$taskArgs=@((Join-Path $PSScriptRoot 'verify-transition-02.cjs'),$taskTransition,$taskSource,$taskArtifact)
if($taskArgs.Count -ne 4){throw 'Four explicit transition-verifier arguments required.'}
Invoke-F16Resume -Name 'transition-verification-02' -Arguments $taskArgs
Write-Output (@{status='PASS_F16_SOURCE_AND_TRANSITION_BYTES';source=$taskSource;transition=$taskTransition;artifact=$taskArtifact;next='F17'}|ConvertTo-Json)
