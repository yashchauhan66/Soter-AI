$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskFailedRoot='D:\SoterAI-Lite-test-profiles\f20a-retained-native-20261020T050909Z-6b099ba2'
$taskFailedEvidence=Join-Path $PSScriptRoot 'f20a-retained-native-20261020T050909Z-6b099ba2'
$taskMainLog=Join-Path $taskFailedRoot 'peer-profile/logs/20261020T103923/main.log'
$taskLog=[IO.File]::ReadAllText($taskMainLog)
if(-not $taskLog.Contains('renderer process gone (reason: oom, code: -536870904)')){throw 'Exact retained resource failure must be observed'}
$taskOwned=@(Get-CimInstance Win32_Process -ErrorAction Stop|Where-Object{($_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskFailedRoot+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.Name -in @('Code.exe','codex.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($taskFailedRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0)})
$taskAudit=@{status=$(if($taskOwned.Count -eq 0){'NO_CURRENT_OWNED_PROCESSES_OBSERVED'}else{'OWNED_PROCESS_RETAINED_NO_NEW_LAUNCH'});root=$taskFailedRoot;observedAt=[DateTime]::UtcNow.ToString('o');ownedProcesses=@($taskOwned|Select-Object ProcessId,ParentProcessId,Name,ExecutablePath);reason='Actual peer renderer OOM, F14-H11 timed out; primary102PASS1FAIL,37brokerchildren closed/EOF. Failed result remains failed, restart NOT-RUN. No OS/resource change or process signal.';mainLogSha256=(Get-FileHash -LiteralPath $taskMainLog -Algorithm SHA256).Hash.ToLowerInvariant()}
$taskAudit|ConvertTo-Json -Depth 6|Out-File -LiteralPath (Join-Path $taskFailedEvidence 'resource-audit-01.json') -Encoding utf8 -NoClobber
[IO.File]::Copy($taskMainLog,(Join-Path $taskFailedEvidence 'peer-main-oom-01.log'),$false)
if($taskOwned.Count -ne 0){throw 'Failed owned peer window remains; no new native launch, closeWindow recovery required'}
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-03.json') -Raw|ConvertFrom-Json
$taskFreeze=Get-Content -LiteralPath (Join-Path $taskFailedEvidence 'freeze.json') -Raw|ConvertFrom-Json
$taskHost=Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-broker-host.js'
if((Get-FileHash -LiteralPath $taskHost -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFreeze.hostProbeSha256){throw 'Retry must use exact original failed fixture bytes'}
$taskBundle=@($taskInspection.entries|Where-Object{$_.path -ceq 'extension/dist/extension.js'})[0].sha256
if($taskInspection.sha256 -cne '619d8caf4e7b7f2f15ff2087ff263c259da129a821d37a457010cfa9f54e9876'){throw 'Exact unchanged candidate04 required'}
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F20BResourceCheck([string]$Name,[string[]]$Arguments){
 & $taskRunner -FilePath powershell -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw|ConvertFrom-Json
 if($taskResult.exitCode -ne 0){throw ('Current gate remains incomplete: '+$Name)}
}
Invoke-F20BResourceCheck 'retained-native-03' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-retained-native-01.ps1'),'-CodePath','C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe','-HostTestsPath',$taskHost,'-ExtensionRoot',$taskInspection.extractedExtensionRoot,'-VsixPath',$taskInspection.vsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle)
Invoke-F20BResourceCheck 'current-affected-launch-03' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-04.ps1'))
Invoke-F20BResourceCheck 'ide-product-matrix-launch-02' @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-ide-product-matrix-02.ps1'))
@{status='CURRENT_AUTOMATED_GATES_PASSED_PENDING_EXACT_ACCEPTANCE_AND_BYTE_BARRIERS';feature='F20B';artifact=$taskInspection.sha256;retainedFailure='Original102PASS1FAIL peer renderer OOM retained; no source/fixture bytes changed for retry; do not regrade original';scope='Current CLI20/retained106/functional10/security17/IDE21. Scripted LOW; no physical webview/human/independent/OS claim.';observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Out-File -LiteralPath (Join-Path $PSScriptRoot 'final-automated-gates-02.json') -Encoding utf8 -NoClobber
