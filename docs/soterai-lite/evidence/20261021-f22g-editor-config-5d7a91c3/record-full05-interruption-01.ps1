$ErrorActionPreference='Stop'
$taskRows=@(Get-CimInstance Win32_Process -Filter "(Name='node.exe' AND (ParentProcessId=18216 OR CommandLine LIKE '%Ai-Agent-Security-Guard%vscode-extension%__tests__%' OR CommandLine LIKE '%vscode-extension/src/__tests__%')) OR (Name='powershell.exe' AND CommandLine LIKE '%f22g-editor-config-5d7a91c3%run-final%')"|Where-Object {$_.ProcessId -ne $PID})
if($taskRows.Count -ne 0){throw 'Owned test/pipeline metadata remains; retry withheld.'}
$taskMissing=@()
foreach($taskName in @('full-tests-05.txt','full-tests-05.txt.result.json','final-gates-run-06.txt','final-gates-run-06.txt.result.json','package-03.txt','vsix-inspection-03.json')){
 if(Test-Path -LiteralPath (Join-Path $PSScriptRoot $taskName)){throw 'Old output appeared; reconcile before retry.'}
 $taskMissing+=$taskName
}
$taskReport=@{status='INCOMPLETE_UNOBSERVED_EXIT_NO_RAW_OR_RECEIPT';feature='F22g';attempt='full05/pipeline06';checkedAt=[DateTime]::UtcNow.ToString('o');previousToolSession=80540;lastToolResponse='write_stdin failed: Unknown process id 80540';earlierStatusProbe='Thread failed to start.';ownedRepoTestOrPipelineMatches=0;missing=$taskMissing;signalsRequested=0;cause='UNESTABLISHED';scope='No inferred suite pass, exit code or clean withdrawal. Narrow read-only process metadata authorizes a new serial unchanged-product verification attempt; old absence and tool-session failure remain first-class evidence. No old raw output was available to retain.'}
$taskText=($taskReport|ConvertTo-Json -Depth 8)+[Environment]::NewLine
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($taskText)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'full05-interruption-01.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
$taskText
