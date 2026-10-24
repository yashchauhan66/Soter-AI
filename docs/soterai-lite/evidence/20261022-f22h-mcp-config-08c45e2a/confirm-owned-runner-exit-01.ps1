param([Parameter(Mandatory=$true)][ValidateSet('serial','native')][string]$Kind)
$ErrorActionPreference='Stop'
$taskStartFile=Join-Path $PSScriptRoot ('durable-'+$Kind+'-01.json')
$taskStart=Get-Content -LiteralPath $taskStartFile -Raw -Encoding UTF8|ConvertFrom-Json
$taskInnerName=if($Kind -ceq 'serial'){'serial-gates-run-01.txt'}else{'native-gates-run-01.txt'}
$taskInnerFile=Join-Path $PSScriptRoot $taskInnerName
$taskInner=Get-Content -LiteralPath ($taskInnerFile+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInner.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskInnerFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInner.sha256.ToLowerInvariant()){throw 'Actual successful inner receipt missing or changed.'}
if($taskStart.pid -isnot [int] -or $taskStart.pid -le 0){throw 'Owned runner identity missing.'}
function Get-StreamFacts {
 $taskRows=@()
 foreach($taskFile in @($taskStart.stdout,$taskStart.stderr)){
  $taskResolved=[IO.Path]::GetFullPath($taskFile)
  if([IO.Path]::GetDirectoryName($taskResolved) -cne [IO.Path]::GetFullPath($PSScriptRoot)){throw 'Owned stream outside evidence root.'}
  $taskRows+=@{path=[IO.Path]::GetFileName($taskResolved);bytes=(Get-Item -LiteralPath $taskResolved).Length;sha256=(Get-FileHash -LiteralPath $taskResolved -Algorithm SHA256).Hash.ToLowerInvariant()}
 }
 return $taskRows
}
$taskFirst=Get-StreamFacts
Start-Sleep -Milliseconds 500
$taskSecond=Get-StreamFacts
if(($taskFirst|ConvertTo-Json -Compress) -cne ($taskSecond|ConvertTo-Json -Compress)){throw 'Owned streams still changing.'}
$taskOwned=Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue
if($taskOwned){throw 'Owned runner PID still present; no signals or inferred exit.'}
$taskReport=@{status='PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS';runnerId=$taskStart.pid;runnerAbsent=$true;wrapperExitCodeObserved=$null;innerExitCode=$taskInner.exitCode;inner=$taskInnerName;innerSha256=$taskInner.sha256.ToLowerInvariant();streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;scope='Only this newly recorded owned PID checked; absence never proves wrapper exit0 or descendant closure. Native phases require their separate actual exit/EOF receipts.'}
$taskReport|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot ('durable-'+$Kind+'-exit-01.json')) -Encoding utf8 -NoClobber
$taskReport|ConvertTo-Json -Depth 8
