$ErrorActionPreference='Stop'
$repoRoot=(Get-Location).Path
$evidenceRoot=Join-Path $repoRoot 'docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a'
foreach($record in @(
    @{Script='run-serial-05.cjs';Owner='durable-serial-owner-05.json';Out='durable-serial-stdout-05.txt';Err='durable-serial-stderr-05.txt'},
    @{Script='watch-postfull-04.cjs';Owner='postfull-watcher-owner-04.json';Out='postfull-watcher-stdout-04.txt';Err='postfull-watcher-stderr-04.txt'}
)){
    $scriptFile=Join-Path $evidenceRoot $record.Script
    $ownerFile=Join-Path $evidenceRoot $record.Owner
    $outFile=Join-Path $evidenceRoot $record.Out
    $errFile=Join-Path $evidenceRoot $record.Err
    if((Test-Path -LiteralPath $ownerFile) -or (Test-Path -LiteralPath $outFile) -or (Test-Path -LiteralPath $errFile)){throw 'Existing owner evidence refuses duplicate launch'}
    $ownedProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$scriptFile+'"') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru
    $value=[ordered]@{status='STARTED_NOT_COMPLETED';pid=$ownedProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$scriptFile;stdout=$outFile;stderr=$errFile;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
    $bytes=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 5))
    $stream=[IO.File]::Open($ownerFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
    try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
    $value|ConvertTo-Json -Compress
}
