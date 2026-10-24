$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-Checked([string]$Name,[string]$Program,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-current-inputs-02.cjs')
 if($LASTEXITCODE -ne 0){throw 'Frozen source/test input drift; stop before next gate.'}
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Native gate stopped; retained: '+$Name)}
}
$taskSerial=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-serial-exit-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskSerial.status -cne 'PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS' -or $taskSerial.innerExitCode -ne 0 -or $taskSerial.runnerAbsent -ne $true){throw 'Serial suite completion and owned runner closure required.'}
Invoke-Checked 'build-native-hosts-run-01' 'node' @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-01')
Invoke-Checked 'mcp-fixture-prelaunch-run-01' 'node' @((Join-Path $PSScriptRoot 'verify-mcp-fixture-01.cjs'))
Invoke-Checked 'native-payload-validation-run-01' 'node' @('--import','tsx',(Join-Path $PSScriptRoot 'validate-native-payloads-01.cjs'))
Invoke-Checked 'prelaunch-run-02' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-prelaunch-02.ps1'))
Invoke-Checked 'candidate01-gates-run-01' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'complete-candidate01-02.ps1'))
& node (Join-Path $PSScriptRoot 'check-current-inputs-02.cjs')
if($LASTEXITCODE -ne 0){throw 'Frozen source drift after native suite.'}
@{status='PASS_CURRENT_F22H_NATIVE_AND_AFFECTED_GATES';scope='Exact new artifact/scripted isolated workflows; evidence/byte acceptance still pending.'}|ConvertTo-Json
exit 0
