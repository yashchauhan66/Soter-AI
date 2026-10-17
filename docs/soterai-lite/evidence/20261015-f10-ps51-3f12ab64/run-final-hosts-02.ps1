$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f10-20261017-attempt01.vsix'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-02/extension'
$taskHost=Join-Path $PSScriptRoot 'prebuilt-native-host-01/lite-powershell51-host.js'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskVsixSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskBundleSha=(Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
foreach($taskRun in @(@{Name='native-launch-02';Script='run-native-01.ps1';Extra=@('-HostTestsPath',$taskHost,'-ExtensionRoot',$taskExtension)},@{Name='affected-launch-02';Script='run-affected-hosts-03.ps1';Extra=@('-InspectionName','02')})){
 $taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskRun.Script),'-CodePath',$taskCode,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)+$taskRun.Extra
 & $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot ($taskRun.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskRun.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F10 exact-artifact host failed/incomplete: '+$taskRun.Name)}
}
