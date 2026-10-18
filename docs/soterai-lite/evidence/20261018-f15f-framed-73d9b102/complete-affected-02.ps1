$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskRuntime=@($taskInspection.sourceProvenance.inventory|Where-Object {$_.name -ceq 'extension.js'})[0].sha256
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-affected-hosts-01.ps1'),'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskRuntime,'-InspectionName','01') -OutputFile (Join-Path $PSScriptRoot 'affected-launch-02.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-launch-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Affected checks failed; closure withheld.'}
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'close-card-01.ps1')
if($LASTEXITCODE -ne 0){throw 'Byte barriers incomplete; next production withheld.'}
