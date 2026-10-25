$ErrorActionPreference='Stop'
$taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'durable-native-start-01.json') -Raw|ConvertFrom-Json
$taskRaw=Join-Path $PSScriptRoot 'native-gates-01.txt'
$taskReceipt=Get-Content -LiteralPath ($taskRaw+'.result.json') -Raw|ConvertFrom-Json
if($taskReceipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskRaw -Algorithm SHA256).Hash -ine $taskReceipt.sha256){throw 'Native aggregate failure/integrity mismatch; closure not claimed.'}
if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Original native wrapper PID still observed; identity/closure inspection required.'}
$taskStreams=@();foreach($taskFile in @($taskStart.stdout,$taskStart.stderr)){$taskStreams+=@{path=$taskFile;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
Start-Sleep -Milliseconds 300
if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Native wrapper PID observed during closure check.'}
foreach($taskStream in $taskStreams){if((Get-Item -LiteralPath $taskStream.path).Length -ne $taskStream.bytes -or (Get-FileHash -LiteralPath $taskStream.path -Algorithm SHA256).Hash -ine $taskStream.sha256){throw 'Native wrapper streams still changing.'}}
$taskValue=@{status='PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS';innerExitCode=0;runnerAbsent=$true;wrapperExitObserved=$false;wrapperExitCode=$null;signalsRequested=0;streams=$taskStreams;pid=$taskStart.pid;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskValue|ConvertTo-Json -Depth 7|Out-File -LiteralPath (Join-Path $PSScriptRoot 'durable-native-exit-01.json') -Encoding utf8 -NoClobber
$taskValue|ConvertTo-Json -Depth 7
