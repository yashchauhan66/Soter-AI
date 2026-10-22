$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskName in @('full-tests-06','editor-combined-04','build-native-hosts-run-03','host-fixture-validation-run-06','backend-typecheck-03','backend-tests-03','package-03','inspect-vsix-run-03','editor-native-run-04')){
 $taskOutput=Join-Path $PSScriptRoot ($taskName+'.txt')
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskReceipt.sha256.ToLowerInvariant()){throw 'Unchanged current prerequisite missing or changed.'}
}
$taskProgress=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'f22g-progress-05.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskProgress.records).Count -ne 25){throw 'Frozen authored input count changed.'}
foreach($taskInput in $taskProgress.records){$taskFile=Join-Path $taskRepo $taskInput.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen source changed; unchanged retry refused.'}
}
$taskInputsRaw=Join-Path $PSScriptRoot 'resume-input-verification-run-01.txt'
& $taskRunner -FilePath 'node' -ArgumentList @((Join-Path $PSScriptRoot 'resume-inputs-01.cjs'),'--verify') -OutputFile $taskInputsRaw -WorkingDirectory $taskRepo
$taskInputsReceipt=Get-Content -LiteralPath ($taskInputsRaw+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInputsReceipt.exitCode -ne 0){throw 'Current checkpoint bytes changed; native resume refused.'}
$taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInspection.sha256 -cne 'f27ecdf71536d8ce6cf50b97d3824e8178c2c19e5ca640fd378331788c15b500'){throw 'Current candidate identity changed.'}
$taskVsix=$taskInspection.vsix
$taskBundle=($taskInspection.sourceProvenance.inventory|Where-Object {$_.name -ceq 'extension.js'}).sha256
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F22gEditorHost
$taskOutput=Join-Path $PSScriptRoot 'current-affected-suite-run-05.txt'
& $taskRunner -FilePath 'powershell' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-05.ps1'),'-VsixPath',$taskVsix,'-ExpectedVsixSha256',$taskInspection.sha256,'-ExpectedBundleSha256',$taskBundle) -OutputFile $taskOutput -WorkingDirectory $taskRepo
$taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0){throw 'Unchanged affected retry failed; retain evidence and stop recovery.'}
Assert-F22gEditorHost
@{status='PASS_UNCHANGED_CANDIDATE03_AFFECTED_RECOVERY_GATES';artifact=$taskInspection.sha256;scope='Same source/tests/assertions/timing/current VSIX. Prior actual rendererOOM/failed pipeline retained; no fourth product improvement or failure regrade.'}|ConvertTo-Json
