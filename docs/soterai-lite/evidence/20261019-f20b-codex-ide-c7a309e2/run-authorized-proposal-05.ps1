$ErrorActionPreference='Stop'
$taskApproval=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'user-round-authorization-01.json') -Raw|ConvertFrom-Json
if($taskApproval.status -cne 'AUTHORIZED_ONE_ADDITIONAL_BOUNDED_IDE_FIXTURE_ROUND' -or $taskApproval.userExactReply -cne 'Ek extra isolated round allow karo'){throw 'Exact user additional-round authorization required'}
foreach($taskBinding in @(@{file='ide-feasibility-05.cjs';sha=$taskApproval.driverSha256},@{file='run-ide-feasibility-05.ps1';sha=$taskApproval.launcherSha256},@{file='ide-guards-03.cjs';sha=$taskApproval.guardSha256})){
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $taskBinding.file) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBinding.sha){throw 'Frozen authorized proposal changed'}
}
$taskGateFile=Join-Path $PSScriptRoot 'final-automated-gates-01.json'
$taskDeadline=[DateTime]::UtcNow.AddMinutes(10)
while(-not(Test-Path -LiteralPath $taskGateFile)){
 if([DateTime]::UtcNow -gt $taskDeadline){throw 'NOT-RUN: preceding owned native gates not confirmed closed; do not start overlapping GUI'}
 Start-Sleep -Milliseconds 500
}
$taskGate=Get-Content -LiteralPath $taskGateFile -Raw|ConvertFrom-Json
if($taskGate.status -cne 'AUTOMATED_AFFECTED_GATES_PASSED_IDE_PRODUCT_NATIVE_GATE_STILL_INCOMPLETE'){throw 'Preceding affected native gate failed; no additional IDE launch'}
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-ide-feasibility-05.ps1')) -OutputFile (Join-Path $PSScriptRoot 'ide-feasibility-launch-05.txt')
$taskResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ide-feasibility-launch-05.txt.result.json') -Raw|ConvertFrom-Json
if($taskResult.exitCode -ne 0){throw 'Authorized single extra round INCOMPLETE; retain failure and do not infer a sixth run'}
