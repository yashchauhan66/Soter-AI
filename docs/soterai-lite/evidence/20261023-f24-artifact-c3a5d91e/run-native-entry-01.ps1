$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskM=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-materialization-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskInspectionReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'inspect-vsix-run-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInspectionReceipt.exitCode -ne 0 -or $taskInspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or $taskInspection.sha256 -cne $taskM.artifact.sha256 -or $taskInspection.machineSettings -ne 80){throw 'Exact current content inspection required.'}
if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'inspect-vsix-run-01.txt') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInspectionReceipt.sha256.ToLowerInvariant()){throw 'Current content receipt raw hash mismatch.'}
$taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-native-gates-01.ps1'),'-CodePath',$taskReview.currentHost.executable.path,'-VsixPath',(Join-Path $taskRepo $taskM.artifact.path),'-ExpectedVsixSha256',$taskM.artifact.sha256,'-ExpectedBundleSha256',$taskM.artifact.frontendSha256) -OutputFile (Join-Path $PSScriptRoot 'native-gates-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
