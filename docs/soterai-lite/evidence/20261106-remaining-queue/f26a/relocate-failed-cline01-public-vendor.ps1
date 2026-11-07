$ErrorActionPreference='Stop'
# Root-only reviewed disk recovery. Only the failed Cline01 public vendor clone is moved.
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskFailed=[IO.Path]::GetFullPath((Join-Path $taskRepo 'docs/soterai-lite/evidence/20261106-v01-cline-01'))
$taskSource=[IO.Path]::GetFullPath((Join-Path $taskFailed 'public-vendor'))
$taskTargetParent='D:\SoterAI-Lite-test-profiles\cline01-public-vendor-archive-20261106-3a1d7b9c'
$taskTarget=[IO.Path]::GetFullPath((Join-Path $taskTargetParent 'public-vendor'))
function Assert-TaskNoLinks([string]$Path){
 $taskCurrent=[IO.Path]::GetFullPath($Path)
 while($taskCurrent){$taskItem=Get-Item -LiteralPath $taskCurrent -Force;if($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Linked path refused: $Path"};$taskCurrent=[IO.Path]::GetDirectoryName($taskCurrent)}
}
if($taskSource -cne 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor'){throw 'Exact source root required'}
if($taskTarget -cne 'D:\SoterAI-Lite-test-profiles\cline01-public-vendor-archive-20261106-3a1d7b9c\public-vendor' -or -not $taskTarget.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase)){throw 'Exact allowed target root required'}
Assert-TaskNoLinks $taskSource
Assert-TaskNoLinks 'D:\SoterAI-Lite-test-profiles'
if(Test-Path -LiteralPath $taskTargetParent){throw 'Existing archive refused'}
$taskBindingPath=Join-Path $taskFailed 'route-binding.json'
$taskBindingHash=(Get-FileHash -LiteralPath $taskBindingPath -Algorithm SHA256).Hash.ToLowerInvariant()
$taskBinding=Get-Content -LiteralPath $taskBindingPath -Raw|ConvertFrom-Json
$taskClose=Get-Content -LiteralPath (Join-Path $taskFailed 'route-owned-close.json') -Raw|ConvertFrom-Json
if(-not $taskClose.actualClose -or $taskClose.exitCode -ne 1 -or -not $taskClose.stdoutEOF -or -not $taskClose.stderrEOF -or $taskClose.signalsRequested -ne 0){throw 'Actual failed route closure required'}
if($taskBinding.id -cne 'cline' -or $taskBinding.publicInputs.Count -ne 38){throw 'Original38 public inputs required'}
$taskSourceEntries=@(Get-ChildItem -LiteralPath $taskSource -Recurse -Force)
if(@($taskSourceEntries|Where-Object{$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count -ne 0){throw 'Linked vendor entries refused'}
if(@($taskSourceEntries|Where-Object{-not $_.PSIsContainer}).Count -ne 38){throw 'Unexpected source tree contents'}
$taskRows=@()
foreach($taskInput in $taskBinding.publicInputs){
 $taskInputPath=[IO.Path]::GetFullPath((Join-Path $taskRepo $taskInput.path))
 if(-not $taskInputPath.StartsWith($taskSource+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Binding input outside source root'}
 $taskRelative=$taskInputPath.Substring($taskSource.Length+1)
 $taskDestination=[IO.Path]::GetFullPath((Join-Path $taskTarget $taskRelative))
 if(-not $taskDestination.StartsWith($taskTarget+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destination escaped root'}
 $taskFile=Get-Item -LiteralPath $taskInputPath -Force
 if($taskFile.Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Source public bytes differ'}
 $taskRows+=@{relativePath=$taskRelative;bytes=$taskInput.bytes;sha256=$taskInput.sha256;source=$taskInputPath;archive=$taskDestination}
}
if(($taskRows|Measure-Object bytes -Sum).Sum -ne 38239400){throw 'Unexpected source byte total'}
[void][IO.Directory]::CreateDirectory($taskTarget)
foreach($taskRow in $taskRows){[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskRow.archive));Copy-Item -LiteralPath $taskRow.source -Destination $taskRow.archive -ErrorAction Stop}
foreach($taskRow in $taskRows){
 foreach($taskPath in @($taskRow.source,$taskRow.archive)){
  Assert-TaskNoLinks $taskPath
  if((Get-Item -LiteralPath $taskPath).Length -ne $taskRow.bytes -or (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.sha256){throw 'Byte verification refused deletion'}
 }
}
$taskReceipt=@{status='ALL38_SOURCE_AND_ARCHIVE_BYTES_REHASHED_BEFORE_SCOPED_REMOVAL';at=[DateTime]::UtcNow.ToString('o');sourceRoot=$taskSource;archiveRoot=$taskTarget;files=38;bytes=38239400;originalBindingSha256=$taskBindingHash;entries=$taskRows;reason='Failed Cline01 public artifact clone moved to D to reclaim C space; logs, binding and failure retained. This is not native acceptance.'}
$taskReceiptText=$taskReceipt|ConvertTo-Json -Depth 8
$taskBefore=Join-Path $taskFailed 'public-vendor-relocation-before.json'
if(Test-Path -LiteralPath $taskBefore){throw 'Prior relocation receipt refused'}
[IO.File]::WriteAllText($taskBefore,$taskReceiptText,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskTargetParent 'relocation-before.json'),$taskReceiptText,[Text.UTF8Encoding]::new($false))
# Final destructive target check: only the exact known failed-session clone, never a computed parent.
if([IO.Path]::GetFullPath((Get-Item -LiteralPath $taskSource -Force).FullName) -cne 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor'){throw 'Final exact removal target check failed'}
Assert-TaskNoLinks $taskSource
Remove-Item -LiteralPath 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor' -Recurse -Force -ErrorAction Stop
if(Test-Path -LiteralPath $taskSource){throw 'Source removal incomplete; archive retained'}
foreach($taskRow in $taskRows){if((Get-Item -LiteralPath $taskRow.archive).Length -ne $taskRow.bytes -or (Get-FileHash -LiteralPath $taskRow.archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.sha256){throw 'Post-relocation archive changed'}}
$taskAfter=@{status='COMPLETE_BYTE_EXACT_SCOPED_PUBLIC_VENDOR_RELOCATION';at=[DateTime]::UtcNow.ToString('o');sourceRoot=$taskSource;sourceAbsent=$true;archiveRoot=$taskTarget;files=38;bytes=38239400;beforeReceiptSha256=(Get-FileHash -LiteralPath $taskBefore -Algorithm SHA256).Hash.ToLowerInvariant();originalBindingSha256=$taskBindingHash;oldAdmissionPathResolution='Original failed01 admission retains original paths. Resolve public-vendor files using the immutable before receipt; do not rerun failed01.'}|ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $taskFailed 'public-vendor-relocation.json'),$taskAfter,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskTargetParent 'relocation.json'),$taskAfter,[Text.UTF8Encoding]::new($false))
Write-Output $taskAfter
