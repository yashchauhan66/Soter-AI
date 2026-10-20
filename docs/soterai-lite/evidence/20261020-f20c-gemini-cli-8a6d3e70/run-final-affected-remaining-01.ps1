$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
foreach($taskLabel in @('full-tests-04','current-affected-cli-launch-01','current-affected-ide-diagnostic-launch-01','gemini-product-matrix-launch-03')){
 $taskReceipt=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot ($taskLabel+'.txt.result.json'))|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Prior gate incomplete: '+$taskLabel)}
}
foreach($taskPair in @(@('current-retained-launch-01','run-current-retained-04.ps1'),@('current-affected-launch-01','run-current-affected-05.ps1'))){
 $taskOutput=Join-Path $PSScriptRoot ($taskPair[0]+'.txt')
 & $taskRunner -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot $taskPair[1])) -OutputFile $taskOutput -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -Raw -LiteralPath ($taskOutput+'.result.json')|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Final current affected gate incomplete: '+$taskPair[0])}
}
