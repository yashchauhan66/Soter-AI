$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F18Final([string]$Name,[string]$Program,[string[]]$Arguments){
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo|Out-Null
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 Write-Output ($Name+' exit='+$taskResult.exitCode)
 if($taskResult.exitCode -ne 0){throw ('F18 native gate failed: '+$Name)}
}
Invoke-F18Final 'product-matrix-launch-03' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-product-matrix-04.ps1'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-08.json') -Raw|ConvertFrom-Json
$taskBundle=(Get-FileHash -LiteralPath (Join-Path $taskInspection.extractedExtensionRoot 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
Invoke-F18Final 'retained-native-launch-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-retained-native-01.ps1'),'-CodePath','C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/Code.exe','-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-broker-host.js'),'-ExtensionRoot',$taskInspection.extractedExtensionRoot,'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle)
Invoke-F18Final 'affected-launch-01' 'powershell' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-affected-hosts-01.ps1'),'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle,'-InspectionName','08')
