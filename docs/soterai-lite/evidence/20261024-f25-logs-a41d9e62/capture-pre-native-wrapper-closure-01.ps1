$ErrorActionPreference='Stop'
$taskRows=@(
 @{start='durable-full-start-03.json';gate='full-gates-03.txt.result.json';expected=1},
 @{start='durable-full-start-04.json';gate='full-gates-04.txt.result.json';expected=0},
 @{start='durable-native-build-start-01.json';gate='build-native-hosts-run-01.txt.result.json';expected=0}
)
$taskResults=@()
foreach($taskRow in $taskRows){
 $taskStart=Get-Content -LiteralPath (Join-Path $PSScriptRoot $taskRow.start) -Raw -Encoding UTF8|ConvertFrom-Json
 $taskGate=Get-Content -LiteralPath (Join-Path $PSScriptRoot $taskRow.gate) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskGate.exitCode -ne $taskRow.expected){throw 'Unexpected actual inner gate exit.'}
 if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Owned wrapper still observed; closure not claimed.'}
 $taskStreams=@();foreach($taskFile in @($taskStart.stdout,$taskStart.stderr)){$taskStreams+=@{path=$taskFile;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}}
 Start-Sleep -Milliseconds 300
 if(Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue){throw 'Wrapper PID now observed; closure not claimed.'}
 foreach($taskStream in $taskStreams){if((Get-Item -LiteralPath $taskStream.path).Length -ne $taskStream.bytes -or (Get-FileHash -LiteralPath $taskStream.path -Algorithm SHA256).Hash -ine $taskStream.sha256){throw 'Wrapper streams still changing.'}}
 $taskResults+=@{status='ABSENT_STABLE_STREAMS_INNER_EXIT_OBSERVED_WRAPPER_EXIT_UNOBSERVED';pid=$taskStart.pid;startReceipt=$taskRow.start;innerReceipt=$taskRow.gate;innerExitCode=$taskGate.exitCode;wrapperExitCode=$null;pidAbsentTwice=$true;streamsStable=$true;streams=$taskStreams;signalsRequested=0}
}
$taskValue=@{status='PASS_READ_ONLY_WRAPPER_OBSERVATIONS_NO_EXIT_CODE_FABRICATION';records=$taskResults;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskPath=Join-Path $PSScriptRoot 'pre-native-wrapper-closures-01.json'
if(Test-Path -LiteralPath $taskPath){throw 'Existing closure receipt refused.'}
$taskValue|ConvertTo-Json -Depth 8|Out-File -LiteralPath $taskPath -Encoding utf8 -NoClobber
$taskValue|ConvertTo-Json -Depth 8
