param([Parameter(Mandatory=$true)][string]$CodePath,[Parameter(Mandatory=$true)][string]$ExtensionRoot)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskBuildLog=Join-Path $PSScriptRoot 'host-build-01.txt'
$taskBuildReceipt=$taskBuildLog+'.result.json'
if(-not(Test-Path -LiteralPath $taskBuildReceipt)){throw 'Root must build the reviewed native fixture first.'}
$taskBuilt=Get-Content -LiteralPath $taskBuildReceipt -Raw -Encoding UTF8|ConvertFrom-Json
if($taskBuilt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskBuildLog).Hash -ne $taskBuilt.sha256){throw 'Host build receipt missing or changed.'}
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-native-01.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-host-01/lite-vault-runtime-host.js'),'-ExtensionRoot',$ExtensionRoot) -OutputFile (Join-Path $PSScriptRoot 'native-host-launch-01.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-host-launch-01.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Native runtime acceptance failed or incomplete; retain all evidence.'}
