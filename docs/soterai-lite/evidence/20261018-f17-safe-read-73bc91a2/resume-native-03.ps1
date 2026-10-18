$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskArgs=@((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-03')
& $taskRunner -FilePath node -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot 'host-build-03.txt') -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-build-03.txt.result.json') -Raw | ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Native diagnostic fixture compiler/build failed'}
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f17-20261018-attempt01.vsix'
$taskRuntime=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
$taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-native-broker-01.ps1'),'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-03/lite-broker-host.js'),'-ExtensionRoot',$taskRuntime,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant(),'-ExpectedBundleSha256',(Get-FileHash -LiteralPath (Join-Path $taskRuntime 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant())
& $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot 'native-launch-03.txt') -WorkingDirectory $taskRepo
