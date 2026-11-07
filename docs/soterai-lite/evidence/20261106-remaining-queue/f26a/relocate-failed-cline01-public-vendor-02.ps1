$ErrorActionPreference='Stop'
# Root-only reviewed successor. Script01 is retained; it refused before any writes.
$taskRepo='C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard'
$taskTestRoot='D:\SoterAI-Lite-test-profiles'
$taskFailed=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261106-v01-cline-01'
$taskSource=Join-Path $taskFailed 'public-vendor'
$taskTargetParent='D:\SoterAI-Lite-test-profiles\cline01-public-vendor-archive-20261106-3a1d7b9c'
$taskTarget=Join-Path $taskTargetParent 'public-vendor'
$taskAdmission=Join-Path $PSScriptRoot 'relocate-cline01-realpath-admission-02.cjs'
if((Get-FileHash -LiteralPath $taskAdmission -Algorithm SHA256).Hash.ToLowerInvariant() -cne '82ae2349c415755e2fc4cd4584f59c38c7e6d6ba8aeadfa001c310b81437922b'){throw 'Native realpath admission changed'}
function Assert-TaskNoLinksWithin([string]$Path,[string]$Boundary){
 $taskCurrent=[IO.Path]::GetFullPath($Path)
 if($taskCurrent -cne $Boundary -and -not $taskCurrent.StartsWith($Boundary+'\',[StringComparison]::Ordinal)){throw 'Path outside admitted boundary'}
 while($true){
  $taskItem=Get-Item -LiteralPath $taskCurrent -Force
  if($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Linked path inside admitted boundary refused: $taskCurrent"}
  if($taskCurrent -ceq $Boundary){break}
  $taskCurrent=[IO.Path]::GetDirectoryName($taskCurrent)
  if(-not $taskCurrent -or ($taskCurrent -cne $Boundary -and -not $taskCurrent.StartsWith($Boundary+'\',[StringComparison]::Ordinal))){throw 'Ancestor traversal escaped admitted boundary'}
 }
}
function Get-TaskNativeAdmission([string]$Mode){
 $taskText=& 'C:\Program Files\nodejs\node.exe' $taskAdmission $Mode
 if($LASTEXITCODE -ne 0){throw "Native realpath and byte admission refused: $Mode"}
 $taskResult=($taskText -join [Environment]::NewLine)|ConvertFrom-Json
 if($taskResult.status -cne 'PASS_READ_ONLY_NATIVE_REALPATH_AND_ALL38_PUBLIC_BYTES' -or $taskResult.mode -cne $Mode){throw 'Unexpected native admission result'}
 return $taskResult
}
if([IO.Path]::GetFullPath($taskSource) -cne 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor'){throw 'Exact source root required'}
if([IO.Path]::GetFullPath($taskTarget) -cne 'D:\SoterAI-Lite-test-profiles\cline01-public-vendor-archive-20261106-3a1d7b9c\public-vendor'){throw 'Exact target root required'}
$taskBeforeAdmission=Get-TaskNativeAdmission 'before'
Assert-TaskNoLinksWithin $taskSource $taskRepo
Assert-TaskNoLinksWithin $taskTestRoot $taskTestRoot
if(Test-Path -LiteralPath $taskTargetParent){throw 'Existing archive refused'}
$taskEntries=@(Get-ChildItem -LiteralPath $taskSource -Recurse -Force)
if(@($taskEntries|Where-Object{$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count -ne 0){throw 'Linked source entries refused'}
if(@($taskEntries|Where-Object{-not $_.PSIsContainer}).Count -ne 38){throw 'Unexpected source files'}
$taskRows=@($taskBeforeAdmission.entries)
foreach($taskRow in $taskRows){
 if(-not ([IO.Path]::GetFullPath($taskRow.source)).StartsWith($taskSource+'\',[StringComparison]::Ordinal) -or -not ([IO.Path]::GetFullPath($taskRow.archive)).StartsWith($taskTarget+'\',[StringComparison]::Ordinal)){throw 'Unexpected mapped file path'}
 Assert-TaskNoLinksWithin $taskRow.source $taskRepo
 if((Get-Item -LiteralPath $taskRow.source).Length -ne $taskRow.bytes -or (Get-FileHash -LiteralPath $taskRow.source -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.sha256){throw 'Source public bytes differ'}
}
[void][IO.Directory]::CreateDirectory($taskTarget)
foreach($taskRow in $taskRows){[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskRow.archive));Copy-Item -LiteralPath $taskRow.source -Destination $taskRow.archive -ErrorAction Stop}
foreach($taskRow in $taskRows){
 Assert-TaskNoLinksWithin $taskRow.source $taskRepo
 Assert-TaskNoLinksWithin $taskRow.archive $taskTestRoot
 foreach($taskPath in @($taskRow.source,$taskRow.archive)){
  if((Get-Item -LiteralPath $taskPath).Length -ne $taskRow.bytes -or (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.sha256){throw 'Byte verification refused deletion'}
 }
}
$taskCopiedAdmission=Get-TaskNativeAdmission 'copied'
$taskReceipt=@{status='ALL38_SOURCE_AND_ARCHIVE_BYTES_REHASHED_BEFORE_SCOPED_REMOVAL';at=[DateTime]::UtcNow.ToString('o');sourceRoot=$taskSource;archiveRoot=$taskTarget;files=38;bytes=38239400;originalBindingSha256=$taskCopiedAdmission.originalBindingSha256;entries=$taskRows;nativeRealpathAdmission=$taskCopiedAdmission;predecessor='relocate-failed-cline01-public-vendor.ps1 refused before any writes because its ancestor walk exceeded the workspace boundary';reason='Failed Cline01 public artifact clone moved to D to reclaim C space. Logs, original script/admission and failure are retained. This is not native acceptance.'}
$taskReceiptText=$taskReceipt|ConvertTo-Json -Depth 10
$taskBefore=Join-Path $taskFailed 'public-vendor-relocation-before.json'
if(Test-Path -LiteralPath $taskBefore){throw 'Prior relocation receipt refused'}
[IO.File]::WriteAllText($taskBefore,$taskReceiptText,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskTargetParent 'relocation-before.json'),$taskReceiptText,[Text.UTF8Encoding]::new($false))
# Last checks stay within intended boundaries; native-realpath and all bytes were just revalidated.
if([IO.Path]::GetFullPath((Get-Item -LiteralPath $taskSource -Force).FullName) -cne 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor'){throw 'Final exact removal target check failed'}
Assert-TaskNoLinksWithin $taskSource $taskRepo
Remove-Item -LiteralPath 'C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261106-v01-cline-01\public-vendor' -Recurse -Force -ErrorAction Stop
$taskAfterAdmission=Get-TaskNativeAdmission 'after'
$taskAfter=@{status='COMPLETE_BYTE_EXACT_SCOPED_PUBLIC_VENDOR_RELOCATION';at=[DateTime]::UtcNow.ToString('o');sourceRoot=$taskSource;sourceAbsent=$true;archiveRoot=$taskTarget;files=38;bytes=38239400;beforeReceiptSha256=(Get-FileHash -LiteralPath $taskBefore -Algorithm SHA256).Hash.ToLowerInvariant();originalBindingSha256=$taskAfterAdmission.originalBindingSha256;nativeRealpathAdmission=$taskAfterAdmission;oldAdmissionPathResolution='Original failed01 admission retains original paths. Resolve public-vendor files using the immutable before receipt; do not rerun failed01.'}|ConvertTo-Json -Depth 10
[IO.File]::WriteAllText((Join-Path $taskFailed 'public-vendor-relocation.json'),$taskAfter,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $taskTargetParent 'relocation.json'),$taskAfter,[Text.UTF8Encoding]::new($false))
Write-Output 'COMPLETE_BYTE_EXACT_SCOPED_PUBLIC_VENDOR_RELOCATION files38 bytes38239400'
