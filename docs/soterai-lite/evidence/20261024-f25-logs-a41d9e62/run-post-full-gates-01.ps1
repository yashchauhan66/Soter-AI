$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskDeadline=[DateTime]::UtcNow.AddMinutes(40)
$taskFullReceipt=Join-Path $PSScriptRoot 'full-gates-06.txt.result.json'
while(-not (Test-Path -LiteralPath $taskFullReceipt)) {
 if([DateTime]::UtcNow -ge $taskDeadline){throw 'Current full gate has no receipt before bounded wait deadline; no build launched.'}
 Start-Sleep -Seconds 5
}
$taskActual=Get-Content -LiteralPath $taskFullReceipt -Raw -Encoding UTF8|ConvertFrom-Json
if($taskActual.exitCode -ne 0){throw 'Current full gate NONPASS; no build or equivalence launched.'}
Set-Location -LiteralPath $taskRepo
function Invoke-PostGate([string]$Name,[string]$Script){
 & node (Join-Path $PSScriptRoot 'check-full-inputs-06.cjs')
 if($LASTEXITCODE -ne 0){throw 'Frozen current source drift.'}
 & $taskRunner -FilePath node -ArgumentList @((Join-Path $PSScriptRoot $Script)) -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Post-full gate failed; retained: '+$Name)}
}
Invoke-PostGate 'build-native-hosts-run-02' 'build-native-hosts-02.cjs'
Invoke-PostGate 'current-equivalence-run-02' 'record-current-equivalence-02.cjs'
exit 0
