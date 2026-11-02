$ErrorActionPreference='Stop'
$taskPids=@(12048,25332)
$taskRows=@(foreach($i in @(1,2)){
 if($i -eq 2){Start-Sleep -Milliseconds 250}
 $present=@(foreach($pidValue in $taskPids){$v=Get-Process -Id $pidValue -ErrorAction SilentlyContinue;if($null -ne $v){$pidValue}})
 $marked=@(Get-CimInstance Win32_Process -Filter "Name='Code.exe' AND CommandLine LIKE '%SoterAI-Lite-test-profiles%'")
 @{observedAt=[DateTime]::UtcNow.ToString('o');knownPids=$taskPids;presentPids=$present;markedIsolatedCodeCount=$marked.Count}
})
if(@($taskRows|Where-Object{$_.presentPids.Count -ne 0 -or $_.markedIsolatedCodeCount -ne 0}).Count){throw 'Current marked owner absence not confirmed'}
$taskValue=@{status='PASS_CURRENT_KNOWN_CHAIN_WRAPPER_AND_MARKED_CODE_ABSENCE_TWICE';observations=$taskRows;historicalCloseAndEOF='UNCONFIRMED_MISSING_ORIGINAL_RECORDS_NOT_INFERRED';lastEditorHostProfileDirectory='NOT_PRESENT_AT_READ_ONLY_RECONCILIATION';executionSession61168='UNKNOWN_PROCESS_ID_TOOL_RESPONSE';causeOfInterruption='UNKNOWN_NOT_ATTRIBUTED';signalsRequested=0}
$p=Join-Path $PSScriptRoot 'affected-recovery-absence-02.json';$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$b=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 6));$s.Write($b,0,$b.Length)}finally{$s.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
