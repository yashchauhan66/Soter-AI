$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskCheck in @(
 @{Name='affected-verification-01.txt';Args=@('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/verify-affected-result-01.cjs')},
 @{Name='prepare-bindings-01.txt';Args=@('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-bindings-01.cjs')},
 @{Name='acceptance-preflight-01.txt';Args=@('docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/prepare-acceptance-01.cjs','acceptance-bindings-01.json')})){
 & $taskRunner -FilePath node -ArgumentList $taskCheck.Args -OutputFile (Join-Path $PSScriptRoot $taskCheck.Name) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskCheck.Name+'.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F09 acceptance preparation failed: '+$taskCheck.Name)}
}
