$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskStage in @(@{name='acceptance-preparation-01';script='prepare-acceptance-01.cjs'},@{name='index-preparation-01';script='prepare-index-01.cjs'})){
 & $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot $taskStage.script)) -OutputFile (Join-Path $PSScriptRoot ($taskStage.name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskStage.name+'.txt.result.json')) -Raw|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('Exact acceptance/index preparation incomplete: '+$taskStage.name)}
}
