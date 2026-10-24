$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-start-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskInnerPath=Join-Path $PSScriptRoot 'native-gates-01.txt'
$taskInner=Get-Content -LiteralPath ($taskInnerPath+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInner.exitCode -ne 1 -or (Get-FileHash -LiteralPath $taskInnerPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInner.sha256.ToLowerInvariant()){throw 'Original failed inner receipt/hash required.'}
if(@(Get-CimInstance Win32_Process -Filter ('ProcessId = '+[string][int]$taskStart.pid)).Count -ne 0){throw 'Old owned wrapper still present.'}
function Read-F23FailedStreams {return @(@($taskStart.stdout,$taskStart.stderr)|ForEach-Object{@{path=$_;bytes=(Get-Item -LiteralPath $_).Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()}})}
$taskFirst=Read-F23FailedStreams
Start-Sleep -Milliseconds 500
$taskSecond=Read-F23FailedStreams
if(($taskFirst|ConvertTo-Json -Compress) -cne ($taskSecond|ConvertTo-Json -Compress)){throw 'Old streams unstable.'}
$taskValue=@{status='FAILED_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS';pid=$taskStart.pid;innerExitCode=1;runnerAbsent=$true;wrapperExitCode=$null;wrapperExitObserved=$false;signalsRequested=0;streams=$taskSecond}
$taskOut=Join-Path $PSScriptRoot 'failed-native-closure-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOut,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 8
