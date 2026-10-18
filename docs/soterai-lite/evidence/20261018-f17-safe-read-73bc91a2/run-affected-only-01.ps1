$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f17-20261018-attempt01.vsix'
$taskRuntime=Join-Path $PSScriptRoot 'vsix-extracted-01/extension/dist/extension.js'
$taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-affected-hosts-01.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant(),'-ExpectedBundleSha256',(Get-FileHash -LiteralPath $taskRuntime -Algorithm SHA256).Hash.ToLowerInvariant(),'-InspectionName','01')
& $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot 'affected-launch-01.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-launch-01.txt.result.json') -Raw|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'F17 affected checks failed/incomplete; evidence retained'}
