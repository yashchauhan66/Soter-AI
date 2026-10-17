$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f13-20261017-attempt01.vsix'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskSha=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskRuntime=(Get-FileHash -LiteralPath (Join-Path $taskExtension 'dist/extension.js') -Algorithm SHA256).Hash.ToLowerInvariant()
foreach($taskRun in @(
 @{Name='native-bash-launch-01';Script='run-native-bash-01.ps1';Probe='lite-gitbash-host.js'},
 @{Name='native-cmd-launch-01';Script='run-native-cmd-01.ps1';Probe='lite-cmd-bom-host.js'},
 @{Name='native-ps51-launch-01';Script='run-native-ps51-01.ps1';Probe='lite-powershell51-host.js'},
 @{Name='affected-launch-01';Script='run-affected-hosts-01.ps1'}
)){
 $taskExtra=if($taskRun.Probe){@('-HostTestsPath',(Join-Path $PSScriptRoot ('prebuilt-native-hosts-01/'+$taskRun.Probe)),'-ExtensionRoot',$taskExtension)}else{@('-InspectionName','01')}
 $taskArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskRun.Script),'-CodePath',$taskCode,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskSha,'-ExpectedBundleSha256',$taskRuntime)+$taskExtra
 & $taskRunner -FilePath powershell -ArgumentList $taskArgs -OutputFile (Join-Path $PSScriptRoot ($taskRun.Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskRun.Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('F13 host failed/incomplete; retained '+$taskRun.Name)}
}
