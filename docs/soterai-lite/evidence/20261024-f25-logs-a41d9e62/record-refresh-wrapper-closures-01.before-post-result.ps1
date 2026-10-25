$ErrorActionPreference='Stop'
$taskItems=@(
 @{start='durable-full-start-05.json';inner='full-gates-05.txt.result.json';exit=1},
 @{start='durable-full-start-06.json';inner='full-gates-06.txt.result.json';exit=0},
 @{start='durable-post-full-start-01.json';inner='post-full-gates-01.txt.result.json';exit=0}
)
function Get-Streams($taskStart){
 @($taskStart.stdout,$taskStart.stderr)|ForEach-Object {
  $taskFile=Get-Item -LiteralPath $_
  @{path=$taskFile.FullName;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
 }
}
$taskRecords=@()
foreach($taskItem in $taskItems){
 $taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot $taskItem.start) -Raw -Encoding UTF8|ConvertFrom-Json
 $taskInner=Get-Content -LiteralPath (Join-Path $PSScriptRoot $taskItem.inner) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskInner.exitCode -ne $taskItem.exit){throw 'Actual inner exit differs; no closure claim.'}
 if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Owned wrapper PID still present; no closure/termination/adoption.'}
 $taskFirst=@(Get-Streams $taskStart)
 Start-Sleep -Milliseconds 300
 if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'PID present on second observation; no closure claim.'}
 $taskSecond=@(Get-Streams $taskStart)
 if(($taskFirst|ConvertTo-Json -Depth 5 -Compress) -cne ($taskSecond|ConvertTo-Json -Depth 5 -Compress)){throw 'Wrapper streams are not stable.'}
 $taskRecords+=@{pid=$taskStart.pid;startReceipt=$taskItem.start;innerReceipt=$taskItem.inner;innerExitCode=$taskInner.exitCode;pidAbsentTwice=$true;streamsStable=$true;wrapperExitObserved=$false;wrapperExitCode=$null;signalsRequested=0;streams=$taskSecond}
}
$taskResult=@{status='PASS_CURRENT_REFRESH_INNER_RECEIPTS_WRAPPERS_ABSENT_STABLE_NO_EXIT_CODE_FABRICATION';records=$taskRecords;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskResult|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$taskOutput=Join-Path $PSScriptRoot 'refresh-wrapper-closures-01.json'
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskResult|ConvertTo-Json -Depth 8
