$ErrorActionPreference='Stop'
$taskName='f26a-owned-output-native-20261101T174822Z-8569e639'
$taskDir=Join-Path $PSScriptRoot $taskName
$taskClose=Get-Content -LiteralPath (Join-Path $taskDir 'single-helper-pipe-ownership.json') -Raw|ConvertFrom-Json
if($taskClose.status -cne 'ACTUAL_CLOSE_AND_BOTH_EOF_BEFORE_DISPOSE' -or -not $taskClose.observedExit -or $taskClose.exitCode -ne 0 -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF -or $taskClose.signalsRequested -ne 0){throw 'Original owned close incomplete'}
$taskRows=@(foreach($i in @(1,2)){
 if($i -eq 2){Start-Sleep -Milliseconds 250}
 $p=Get-Process -Id $taskClose.pid -ErrorAction SilentlyContinue
 $marked=@(Get-CimInstance Win32_Process -Filter ("Name='Code.exe' AND CommandLine LIKE '%"+$taskName+"%'"))
 @{observedAt=[DateTime]::UtcNow.ToString('o');pid=$taskClose.pid;pidAbsent=($null -eq $p);markedCodeCount=$marked.Count;stdoutSha256=(Get-FileHash -LiteralPath (Join-Path $taskDir 'single-stdout.txt')).Hash.ToLowerInvariant();stderrSha256=(Get-FileHash -LiteralPath (Join-Path $taskDir 'single-stderr.txt')).Hash.ToLowerInvariant()}
})
if(@($taskRows|Where-Object{-not $_.pidAbsent -or $_.markedCodeCount -ne 0}).Count -or $taskRows[0].stdoutSha256 -cne $taskRows[1].stdoutSha256 -or $taskRows[0].stderrSha256 -cne $taskRows[1].stderrSha256){throw 'Absence/stable streams incomplete'}
$taskValue=@{status='PASS_FAILED_OWNED_CODE_ABSENCE_TWICE_STABLE_STREAMS';observations=$taskRows;originalResult='12PASS_7FAIL_NOT_REGRADED';nestedVendorDescendants='NOT_INFERRED';signalsRequested=0}
$taskOutput=Join-Path $PSScriptRoot 'affected-failure-owner-observation-01.json'
$s=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$b=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 6));$s.Write($b,0,$b.Length)}finally{$s.Dispose()}
$taskValue|ConvertTo-Json -Depth 6
