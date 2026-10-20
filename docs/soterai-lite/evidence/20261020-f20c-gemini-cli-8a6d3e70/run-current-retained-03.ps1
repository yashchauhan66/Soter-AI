$ErrorActionPreference='Stop'
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw|ConvertFrom-Json
$taskBundle=@($taskInspection.entries|Where-Object{$_.path -ceq 'extension/dist/extension.js'})[0].sha256
& $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-02') -OutputFile (Join-Path $PSScriptRoot 'retained-native-build-02.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'retained-native-build-02.txt.result.json') -Raw|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Current retained fixture build incomplete'}
& $taskRunner -FilePath powershell.exe -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-retained-native-01.ps1'),'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-broker-host.js'),'-ExtensionRoot',$taskInspection.extractedExtensionRoot,'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle) -OutputFile (Join-Path $PSScriptRoot 'retained-native-02.txt') -WorkingDirectory $taskRepo
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'retained-native-02.txt.result.json') -Raw|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Current retained native checks incomplete; raw evidence retained'}
