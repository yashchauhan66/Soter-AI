$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-current-inputs-04.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current exact source drift before native resume step.'}
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Native resume stopped; raw retained: '+$Name)}
}
$taskClosed=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-failed-exit-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskClosed.status -cne 'PASS_FAILED_NATIVE_RUNNER_ABSENT_STABLE_STREAMS' -or $taskClosed.innerExitCode -ne 1){throw 'Prior failed runner closure required.'}
$taskFull=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-tests-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskFull.exitCode -ne 0){throw 'Current actual full suite required.'}
. (Join-Path $PSScriptRoot 'host-current-binding-02.ps1')
. (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
Assert-F22hEditorHost
$taskVsix=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f22h-20261022-attempt01.vsix'
$taskVsixSha='578a9ef8193d6572eee314ea6b274b4e344db28837560e1cc621f12693465e3a'
$taskBundleSha='26bef1decde9d42cd62ad4d669b502dcbbb2ada143b01b5b160c144d790e5e2a'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskVsixSha -ExtensionRoot $taskExtension -ExpectedBundleSha256 $taskBundleSha
Invoke-Checked 'native-prelaunch-run-03' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-prelaunch-03.ps1'))
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
Invoke-Checked 'mcp-native-run-01' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-mcp-native-02.ps1'),'-CodePath',$taskCode,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-01/lite-mcp-host.js'),'-ExtensionRoot',$taskExtension,'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
Assert-F22hEditorHost
Invoke-Checked 'current-affected-suite-run-02' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-02.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskVsixSha,'-ExpectedBundleSha256',$taskBundleSha)
Assert-F22hEditorHost
@{status='PASS_CURRENT_EXACT_F22H_RESUMED_NATIVE_CANDIDATE';vsixSha256=$taskVsixSha;extensionSha256=$taskBundleSha;scope='Same built/inspected artifact and source/runtime/test data; exact manifest EOL identity stabilized before first Code launch. Original prelaunch aggregate remainsFAIL; feature acceptance/byte barriers pending.'}|ConvertTo-Json
exit 0
