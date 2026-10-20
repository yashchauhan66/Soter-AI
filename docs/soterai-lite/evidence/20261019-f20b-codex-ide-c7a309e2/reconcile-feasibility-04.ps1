$ErrorActionPreference='Stop'
$taskRoot='D:\SoterAI-Lite-test-profiles\f20b-feasibility-20261020T033216Z-984f1f0a'
$taskEvidence=Join-Path $PSScriptRoot 'f20b-feasibility-20261020T033216Z-984f1f0a'
$taskFiles=@('ide-result.json','LOG_MAIN','LOG_EXTHOST','LOG_CODEX')
$taskLogRoot=Get-ChildItem -LiteralPath (Join-Path $taskRoot 'profile/logs') -Directory; if(@($taskLogRoot).Count -ne 1){throw 'One exact isolated log root required'}; $taskLogPrefix='profile/logs/'+$taskLogRoot.Name; $taskFiles=@('ide-result.json',($taskLogPrefix+'/main.log'),($taskLogPrefix+'/window1/exthost/exthost.log'),($taskLogPrefix+'/window1/exthost/openai.chatgpt/Codex.log'));
$taskRows=@()
foreach($taskRelative in $taskFiles){
 $taskSource=Join-Path $taskRoot $taskRelative
 $taskTarget=Join-Path $taskEvidence ('reconcile-04-'+[IO.Path]::GetFileName($taskRelative))
 if(Test-Path -LiteralPath $taskTarget){throw 'Evidence overwrite refused'}
 [IO.File]::Copy($taskSource,$taskTarget,$false)
 $taskRows+=@{relative=$taskRelative;bytes=(Get-Item -LiteralPath $taskTarget).Length;sha256=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskOwned=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.Name -in @('Code.exe','codex.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($taskRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0)})
$taskReceipt=@{status=$(if($taskOwned.Count -eq 0){'NO_CURRENT_OWNED_PROCESSES_OBSERVED'}else{'INCOMPLETE_OWNED_PROCESS_RETAINED'});observedAt=[DateTime]::UtcNow.ToString('o');root=$taskRoot;ownedProcesses=@($taskOwned|Select-Object ProcessId,ParentProcessId,Name,ExecutablePath);files=$taskRows;priorRestrictedQuery='Get-CimInstance : Access denied; HRESULT 0x80041003. Prior printed zero count is NOT closure evidence.';signalAttempts='No signals observed. Actual native closed with code0/signalnull and stdout/stderr EOF; original-manifest vendor activation deadline failed, not regraded';scope='Read-only exact-root process metadata; no process signals, no normal profile reads; failed route remains INCOMPLETE'}
$taskReceipt|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $taskEvidence 'reconcile-04.json') -Encoding utf8 -NoClobber
[pscustomobject]$taskReceipt|Select-Object status,observedAt,ownedProcesses|ConvertTo-Json -Depth 5
