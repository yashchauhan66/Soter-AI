$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F24AcceptanceGate([string]$Name,[string]$Program,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current input drift before acceptance step.'}
 $taskOutput=Join-Path $PSScriptRoot ($Name+'.txt')
 if(Test-Path -LiteralPath $taskOutput){throw 'Existing acceptance raw output refused.'}
 & $taskRunner -FilePath $Program -ArgumentList $Arguments -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskValue=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskValue.exitCode -ne 0){throw ('Acceptance stopped; retained exact failure: '+$Name)}
}
$taskNative=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-gates-02.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskNative.exitCode -ne 0){throw 'Actual native aggregate must pass before acceptance.'}
Invoke-F24AcceptanceGate 'native-closure-run-02' 'powershell' @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'confirm-owned-runner-02.ps1'),'-Kind','native')
Invoke-F24AcceptanceGate 'capture-native-executions-run-02' 'node' @((Join-Path $PSScriptRoot 'capture-native-executions-02.cjs'))
Invoke-F24AcceptanceGate 'acceptance-run-02' 'node' @((Join-Path $PSScriptRoot 'prepare-acceptance-03.cjs'))
Invoke-F24AcceptanceGate 'acceptance-bindings-run-02' 'node' @((Join-Path $PSScriptRoot 'verify-acceptance-bindings-02.cjs'))
Write-Output 'Actual F24 acceptance gates PASS; source/transition byte barriers remain separate.'
exit 0
