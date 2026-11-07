param([Parameter(Mandatory=$true)][string]$CustodyPath)
$ErrorActionPreference='Stop'
. $CustodyPath
function Get-CimInstance {throw 'Pure controls cannot query processes.'}
function Get-NetTCPConnection {throw 'Pure controls cannot query listeners.'}
$taskCreated=[DateTime]::Parse('2026-11-06T15:00:00.100Z').ToUniversalTime()
$taskProfile='D:\SoterAI-Lite-test-profiles\f32-installed-20261106T150000Z-aabbccdd\profile-primary'
$taskWorkspace='D:\SoterAI-Lite-test-profiles\f32-installed-20261106T150000Z-aabbccdd\workspace-primary'
$taskExe='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskArgs=@('--remote-debugging-address=127.0.0.1','--remote-debugging-port=54831',('--user-data-dir='+$taskProfile),$taskWorkspace)
$taskBase=@{
 binding=@{codePid=4512;endpoint='http://127.0.0.1:54831/';profile=$taskProfile;workspace=$taskWorkspace;launchWallMs=([DateTimeOffset]::Parse('2026-11-06T15:00:00.000Z').ToUnixTimeMilliseconds())}
 owner=@{status='STARTED_NOT_COMPLETED';pid=4512;signalsRequested=0;profile=$taskProfile;workspace=$taskWorkspace;observedAt='2026-11-06T15:00:00.200Z';args=$taskArgs}
 executable=@{path=$taskExe}
 root=@{ProcessId=4512;ParentProcessId=1;CreationDate='2026-11-06T15:00:00.100Z';ExecutablePath=$taskExe;CommandLine=('"'+$taskExe+'" '+($taskArgs -join ' '))}
 listeners=@(@{LocalAddress='127.0.0.1';LocalPort=54831;OwningProcess=4512})
}
function Invoke-F32PureCase($Data){
 [void](Assert-F32EarlyRootListenerFacts -Binding $Data.binding -Owner $Data.owner -CodeExecutable $Data.executable -Root $Data.root -RootCreationUtc $taskCreated -Listeners $Data.listeners)
}
$taskRows=[Collections.Generic.List[object]]::new()
Invoke-F32PureCase $taskBase
$taskRows.Add(@{name='Exact captured root listener accepted';status='PASS'})
$taskCases=@(
 @{name='Wrong PID';change={param($d)$d.root.ProcessId=4513}},
 @{name='Wrong port';change={param($d)$d.listeners[0].LocalPort=54832}},
 @{name='Wrong executable';change={param($d)$d.root.ExecutablePath='C:\Windows\System32\cmd.exe'}},
 @{name='Changed creation timestamp';change={param($d)$d.root.CreationDate='2026-11-06T15:00:20.100Z'}},
 @{name='Old PID before owned spawn';change={param($d)$d.binding.launchWallMs+=30000}},
 @{name='Receipt PID differs';change={param($d)$d.owner.pid=4513}},
 @{name='Wrong profile';change={param($d)$d.binding.profile+='-other'}},
 @{name='Wrong debug argument';change={param($d)$d.root.CommandLine=$d.root.CommandLine.Replace('port=54831','port=54832')}},
 @{name='Loopback address missing';change={param($d)$d.root.CommandLine=$d.root.CommandLine.Replace('address=127.0.0.1','address=0.0.0.0')}},
 @{name='Unrecorded extra argument';change={param($d)$d.root.CommandLine+=' --extensionTestsPath=C:\test'}},
 @{name='Descendant listener cannot become early root authority';change={param($d)$d.listeners[0].OwningProcess=4514}},
 @{name='Non-loopback listener';change={param($d)$d.listeners[0].LocalAddress='0.0.0.0'}},
 @{name='No listener';change={param($d)$d.listeners=@()}},
 @{name='Ambiguous listeners';change={param($d)$d.listeners=@($d.listeners[0],$d.listeners[0])}}
)
foreach($taskCase in $taskCases){
 $taskData=ConvertFrom-Json ($taskBase|ConvertTo-Json -Depth 8)
 & $taskCase.change $taskData
 $taskRejected=$false
 try{Invoke-F32PureCase $taskData}catch{$taskRejected=$true}
 if(-not $taskRejected){throw ('Unsafe early receipt accepted: '+$taskCase.name)}
 $taskRows.Add(@{name=$taskCase.name;status='PASS'})
}
@{status='PASS_PURE_EARLY_ROOT_CUSTODY_CONTROLS';passed=$taskRows.Count;failed=0;nativeLaunches=0;processQueries=0;listenerQueries=0;signalsRequested=0;controls=@($taskRows)}|ConvertTo-Json -Depth 5
