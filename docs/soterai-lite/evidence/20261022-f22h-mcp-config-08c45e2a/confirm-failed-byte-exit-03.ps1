$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-byte-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskFile=Join-Path $PSScriptRoot 'byte-barriers-run-03.txt'
$taskInner=Get-Content -LiteralPath ($taskFile+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInner.exitCode -ne 1 -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInner.sha256.ToLowerInvariant()){throw 'Actual retained byte failure required.'}
function Get-ClosedStreamFacts {
 $taskRows=@()
 foreach($taskName in @($taskStart.stdout,$taskStart.stderr)){
  $taskResolved=[IO.Path]::GetFullPath($taskName)
  if([IO.Path]::GetDirectoryName($taskResolved) -cne [IO.Path]::GetFullPath($PSScriptRoot)){throw 'Owned stream containment refused.'}
  $taskRows+=@{path=[IO.Path]::GetFileName($taskResolved);bytes=(Get-Item -LiteralPath $taskResolved).Length;sha256=(Get-FileHash -LiteralPath $taskResolved -Algorithm SHA256).Hash.ToLowerInvariant()}
 }
 return $taskRows
}
$taskFirst=Get-ClosedStreamFacts
Start-Sleep -Milliseconds 500
$taskSecond=Get-ClosedStreamFacts
if(($taskFirst|ConvertTo-Json -Compress) -cne ($taskSecond|ConvertTo-Json -Compress)){throw 'Owned streams still changing.'}
if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Owned failed byte PID still present; no signals.'}
@{status='PASS_FAILED_BYTE_RUNNER_ABSENT_STABLE_STREAMS';innerExitCode=1;inner='byte-barriers-run-03.txt';innerSha256=$taskInner.sha256.ToLowerInvariant();runnerId=$taskStart.pid;runnerAbsent=$true;wrapperExitCodeObserved=$null;streams=$taskSecond;observations=2;observationGapMs=500;signalsRequested=0;bytePipelineStatus='FAIL_RETAINED_NOT_REGRADED'}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'durable-byte-failed-exit-03.json') -Encoding utf8 -NoClobber
Write-Output 'PASS failed byte runner absent/stable streams; original aggregate remains FAIL.'
