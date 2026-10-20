$ErrorActionPreference='Stop'
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw|ConvertFrom-Json
$taskBundle=@($taskInspection.entries|Where-Object{$_.path -ceq 'extension/dist/extension.js'})[0].sha256
& $taskRunner -FilePath powershell.exe -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-affected-hosts-02.ps1'),'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle,'-InspectionName','02') -OutputFile (Join-Path $PSScriptRoot 'affected-hosts-01.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-hosts-01.txt.result.json') -Raw|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Current affected hosts incomplete; raw evidence retained'}
