$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F24RetryGate([string]$Name,[string[]]$Arguments){
 & node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current fixture-only source input drift.'}
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $taskRepo
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Native fixture rebuild gate failed: '+$Name)}
}
$taskPrior=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'failed-native-closure-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskPrior.innerExitCode -ne 1 -or -not $taskPrior.runnerAbsent){throw 'Original failed owned runner closure required.'}
Invoke-F24RetryGate 'build-native-hosts-run-02' @((Join-Path $PSScriptRoot 'build-native-hosts-02.cjs'),'prebuilt-native-hosts-02')
Invoke-F24RetryGate 'verify-native-rebuild-run-02' @((Join-Path $PSScriptRoot 'verify-native-rebuild-02.cjs'))
$taskM=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-materialization-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskOutput=Join-Path $PSScriptRoot 'native-execution-gates-02.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-native-gates-02.ps1'),'-CodePath',$taskReview.currentHost.executable.path,'-VsixPath',(Join-Path $taskRepo $taskM.artifact.path),'-ExpectedVsixSha256',$taskM.artifact.sha256,'-ExpectedBundleSha256',$taskM.artifact.frontendSha256) -OutputFile $taskOutput -WorkingDirectory $taskRepo
$taskActual=Get-Content -LiteralPath ($taskOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskActual.exitCode -ne 0){throw 'Current native execution failed/incomplete; preserve evidence.'}
exit 0
