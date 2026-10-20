$ErrorActionPreference='Stop'
$taskRoot='D:\SoterAI-Lite-test-profiles\f20b-feasibility-20261020T031542Z-e2260a35'
$taskEvidence=Join-Path $PSScriptRoot 'f20b-feasibility-20261020T031542Z-e2260a35'
$taskFiles=@('ide-result.json','profile/logs/20261020T084652/main.log','profile/logs/20261020T084652/window1/exthost/exthost.log','profile/logs/20261020T084652/window1/exthost/openai.chatgpt/Codex.log')
$taskRows=@()
foreach($taskRelative in $taskFiles){
 $taskSource=Join-Path $taskRoot $taskRelative
 $taskTarget=Join-Path $taskEvidence ('reconcile-02-'+[IO.Path]::GetFileName($taskRelative))
 if(Test-Path -LiteralPath $taskTarget){throw 'Evidence overwrite refused'}
 [IO.File]::Copy($taskSource,$taskTarget,$false)
 $taskRows+=@{relative=$taskRelative;bytes=(Get-Item -LiteralPath $taskTarget).Length;sha256=(Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskOwned=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.Name -in @('Code.exe','codex.exe') -and $_.CommandLine -and $_.CommandLine.IndexOf($taskRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0)})
$taskReceipt=@{status=$(if($taskOwned.Count -eq 0){'NO_CURRENT_OWNED_PROCESSES_OBSERVED'}else{'INCOMPLETE_OWNED_PROCESS_RETAINED'});observedAt=[DateTime]::UtcNow.ToString('o');root=$taskRoot;ownedProcesses=@($taskOwned|Select-Object ProcessId,ParentProcessId,Name,ExecutablePath);files=$taskRows;priorRestrictedQuery='Get-CimInstance : Access denied; HRESULT 0x80041003. Prior printed zero count is NOT closure evidence.';signalAttempts='No signals observed. Vendor log successful native exit and stdout/stderr EOF; vendor removed child close listeners, so fixture close observation remains incomplete, not regraded';scope='Read-only exact-root process metadata; no process signals, no normal profile reads; failed route remains INCOMPLETE'}
$taskReceipt|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $taskEvidence 'reconcile-02.json') -Encoding utf8 -NoClobber
[pscustomobject]$taskReceipt|Select-Object status,observedAt,ownedProcesses|ConvertTo-Json -Depth 5
