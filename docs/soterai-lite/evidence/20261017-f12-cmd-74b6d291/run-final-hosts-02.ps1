$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f12-20261017-attempt02.vsix'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-02/extension'
$taskCmdHost=Join-Path $PSScriptRoot 'prebuilt-native-host-02/lite-cmd-host.js'
$taskPsHost=Join-Path $PSScriptRoot 'prebuilt-native-ps51-01/lite-powershell51-host.js'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
foreach($taskRun in @(
 @{Name='native-cmd-launch-02';Script='run-native-cmd-01.ps1';Extra=@('-HostTestsPath',$taskCmdHost,'-ExtensionRoot',$taskExtension)},
 @{Name='native-ps51-launch-02';Script='run-native-ps51-01.ps1';Extra=@('-HostTestsPath',$taskPsHost,'-ExtensionRoot',$taskExtension)},
 @{Name='affected-launch-02';Script='run-affected-hosts-01.ps1';Extra=@('-InspectionName','02')}
)){
 $taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskRun.Script),'-CodePath',$taskCode,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskSha,'-ExpectedBundleSha256',$taskRuntime)+$taskRun.Extra
 & $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot ($taskRun.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskRun.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F12 host failed/incomplete; retained '+$taskRun.Name)}
}
