$ErrorActionPreference='Stop'
$taskNames=@('node.exe','powershell.exe','pwsh.exe')
$taskFound=@(foreach($taskName in $taskNames){Get-CimInstance Win32_Process -Filter ("Name='"+$taskName+"'")|Where-Object {$_.CommandLine -match 'vscode-extension[/\\]src[/\\]__tests__|run-final-local-04\.ps1|soterai-lite.*package\.cjs'}|ForEach-Object{@{pid=$_.ProcessId;parent=$_.ParentProcessId;created=$_.CreationDate.ToUniversalTime().ToString('o');command=$_.CommandLine}}})
$taskBase=$PSScriptRoot
$taskEvidence=@{status='EXPIRED_TOOL_SESSION_NO_FULL_RECEIPT';observedAt=[DateTime]::UtcNow.ToString('o');priorSession=27822;priorNodeExit='UNKNOWN';noPassInferred=$true;processQuery='Read-only exact owned-test/runner pattern, not environment/other process contents';matches=$taskFound;outputs=@(foreach($taskName in @('typecheck-06.txt','typecheck-06.txt.result.json','full-tests-03.txt','full-tests-03.txt.result.json','package-02.txt','host-build-02.txt')){$taskFile=Join-Path $taskBase $taskName;@{name=$taskName;exists=(Test-Path -LiteralPath $taskFile)}})}
$taskEvidence|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $taskBase 'expired-run-reconciliation-01.json') -Encoding utf8 -NoClobber
if($taskFound.Count){throw 'Existing owned process remains; no duplicate run authorized by this receipt.'}
$taskEvidence|ConvertTo-Json -Depth 8
