$ErrorActionPreference='Stop'
$taskOriginal=Join-Path $PSScriptRoot 'installed-broker-custody-proposed-01.ps1'
if((Get-FileHash -LiteralPath $taskOriginal -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'dfd814c20865f464ff197cab4eeb897163b20c5ff5d8b5c68500e99f2f27bee5'){throw 'Frozen broker01 bytes changed.'}
$taskSource=[IO.File]::ReadAllText($taskOriginal)
$taskNeedle='    $taskCustodyBinding=Copy-F32BrokerBinding $taskBinding'
if([regex]::Matches($taskSource,[regex]::Escape($taskNeedle)).Count -ne 1){throw 'One exact watcher custody-copy statement required.'}
$taskInsertion=@'
    # The initial debugger listener may precede extension-host creation. Refresh
    # the same strict root/profile tree after the actual observer started the
    # broker; do not adopt descendants from an earlier incomplete snapshot.
    $taskFreshCodeCustodyFact=Write-F32ListenerCustody -BindingPath $BindingPath -OutputPath (Join-Path $taskBinding.gate 'restart-owned-broker-current-parent-custody.json')
    $taskCustodyBinding=Copy-F32BrokerBinding $taskBinding
    $taskCustodyBinding['listenerCustody']=$taskFreshCodeCustodyFact
'@
$taskCandidate=$taskSource.Replace($taskNeedle,$taskInsertion.Replace("`r`n","`n").Replace("`n","`r`n"))
$taskCandidate="# Successor02: refresh strict captured-root Code tree after observer readiness.`r`n"+$taskCandidate
$taskErrors=$null;$taskTokens=$null
[void][Management.Automation.Language.Parser]::ParseInput($taskCandidate,[ref]$taskTokens,[ref]$taskErrors)
if(@($taskErrors).Count -ne 0){throw 'Successor syntax invalid.'}
$taskOutput=Join-Path $PSScriptRoot 'installed-broker-custody-proposed-02.ps1'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($taskCandidate)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
