$ErrorActionPreference='Stop'
$taskRun=Join-Path $PSScriptRoot 'f26a-precommit-native-20261102T131326Z-691858c5'
$taskStart=Get-Content -LiteralPath (Join-Path $taskRun 'primary-owned-editor-start.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskStart.pid -ne 18160 -or $taskStart.profile -notlike 'D:\SoterAI-Lite-test-profiles\f26a-precommit-native-20261102T131326Z-691858c5\*'){throw 'Unexpected synthetic owner'}
$taskQueue=[Collections.Generic.Queue[int]]::new();$taskQueue.Enqueue([int]$taskStart.pid)
$taskSeen=[Collections.Generic.HashSet[int]]::new();$taskRows=@()
while($taskQueue.Count -gt 0 -and $taskSeen.Count -lt 128){
 $taskSelected=$taskQueue.Dequeue();if(-not $taskSeen.Add($taskSelected)){continue}
 $taskProcesses=@(Get-CimInstance Win32_Process -Filter "ProcessId=$taskSelected OR ParentProcessId=$taskSelected")
 foreach($taskProcess in $taskProcesses){
  if($taskProcess.ProcessId -ne $taskSelected){$taskQueue.Enqueue([int]$taskProcess.ProcessId)}
  if(@($taskRows|Where-Object{$_.pid -eq $taskProcess.ProcessId}).Count -gt 0){continue}
  $taskCommand=[string]$taskProcess.CommandLine
  $taskKind=if($taskCommand -match '--type=renderer'){'CODE_RENDERER'}elseif($taskCommand -match '--type=utility'){'CODE_UTILITY'}elseif($taskCommand -match 'pre-commit-client[.]js'){'PACKAGED_PRECOMMIT_CLIENT'}elseif($taskProcess.Name -ieq 'git.exe'){'GIT_OWNED_DESCENDANT'}elseif($taskProcess.Name -ieq 'sh.exe'){'GIT_SHELL_OWNED_DESCENDANT'}else{'OTHER_DECLARED_OWNER_DESCENDANT'}
  $taskCpu=Get-Process -Id $taskProcess.ProcessId -ErrorAction SilentlyContinue
  $taskRows+=@{pid=[int]$taskProcess.ProcessId;parentPid=[int]$taskProcess.ParentProcessId;name=$taskProcess.Name;createdUtc=$taskProcess.CreationDate.ToUniversalTime().ToString('o');kind=$taskKind;syntheticPathArgument=($taskCommand -like '*f26a-precommit-native-20261102T131326Z-691858c5*');gitOperation=$(if($taskProcess.Name -ieq 'git.exe'){if($taskCommand -match '\bcat-file\b'){'cat-file'}elseif($taskCommand -match '\bcommit\b'){'commit'}elseif($taskCommand -match '\bhash-object\b'){'hash-object'}elseif($taskCommand -match '\bread-tree\b'){'read-tree'}else{'OTHER'}}else{$null});cpuSeconds=$(if($taskCpu){$taskCpu.CPU}else{$null});workingSet=$(if($taskCpu){$taskCpu.WorkingSet64}else{$null})}
 }
}
$taskResult=@{status='READ_ONLY_OWNED_TREE_OBSERVATION_NO_CLOSURE_INFERENCE';observedAt=[DateTime]::UtcNow.ToString('o');rootPid=$taskStart.pid;rows=$taskRows;boundedAt128=($taskSeen.Count -ge 128);signalsRequested=0;scope='Only exact synthetic Code owner and observed parent-child descendants; no command lines/environment values captured and no process control'}
$taskFile=Join-Path $PSScriptRoot 'native10-live-owned-processes-01.json';if(Test-Path -LiteralPath $taskFile){throw 'Observation overwrite refused'}
[IO.File]::WriteAllText($taskFile,($taskResult|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
$taskResult|ConvertTo-Json -Depth 8
