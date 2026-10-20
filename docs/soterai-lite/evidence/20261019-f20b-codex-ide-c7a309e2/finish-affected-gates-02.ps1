$ErrorActionPreference='Stop'
$taskRunner=Join-Path $PSScriptRoot '../20261013-l0-resume-88fb9432/run-check.ps1'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-03.ps1')) -OutputFile (Join-Path $PSScriptRoot 'current-affected-launch-02.txt')
$taskChecks=@('combined-after-02','typecheck-02','package-03','inspection-02','full-tests-02','broker-tests-01','broker-typecheck-01','current-affected-cli-launch-01','retained-native-01','current-affected-launch-02')
$taskRows=@()
foreach($taskName in $taskChecks){
 $taskFile=Join-Path $PSScriptRoot ($taskName+'.txt');$taskReceipt=Get-Content -LiteralPath ($taskFile+'.result.json') -Raw|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskReceipt.sha256.ToLowerInvariant()){throw ('Current successful raw check required: '+$taskName)}
 $taskRows+=@{name=$taskName;sha256=$taskReceipt.sha256.ToLowerInvariant()}
}
@{status='AUTOMATED_AFFECTED_GATES_PASSED_IDE_PRODUCT_NATIVE_GATE_STILL_INCOMPLETE';feature='F20B';checks=$taskRows;scope='Exact VSIX candidate03. Previous CLI20/retained106/functional10/security17 only. Original failed affected-host wrapper retained; corrected dependency run is separate. No IDE product acceptance or next card.';observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'final-automated-gates-01.json') -Encoding utf8 -NoClobber
