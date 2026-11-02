$ErrorActionPreference='Stop'
$taskRoot='C:\Users\USER\AppData\Roaming\Code\CachedExtensionVSIXs'
$taskNames=@('openai.chatgpt-26.51021.22027-win32-x64','google.geminicodeassist-2.107.0','anthropic.claude-code-2.1.314-win32-x64','redhat.java-1.58.0-win32-x64','qwenlm.qwen-code-vscode-ide-companion-0.26.4-win32-x64')
function New-Receipt($name,$value){$p=Join-Path $PSScriptRoot $name; $s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$b=[Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 8));$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
$taskResolved=(Resolve-Path -LiteralPath $taskRoot).Path
if($taskResolved -cne $taskRoot){throw 'Unexpected cache root'}
for($p=Get-Item -LiteralPath $taskRoot;$null -ne $p;$p=$p.Parent){if($p.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked ancestor refused'}}
$taskRows=@(foreach($n in $taskNames){
 $p=[IO.Path]::GetFullPath((Join-Path $taskRoot $n));if([IO.Path]::GetDirectoryName($p) -cne $taskRoot){throw 'Outside exact cache root'}
 $f=Get-Item -LiteralPath $p;if($f.PSIsContainer -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $f.LastWriteTimeUtc -gt [DateTime]::UtcNow.AddDays(-2)){throw 'Not old regular cache file'}
 $s=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);try{$h=New-Object byte[] 4;[void]$s.Read($h,0,4);if([BitConverter]::ToString($h) -ne '50-4B-03-04'){throw 'Not ZIP download cache'}}finally{$s.Dispose()}
 [pscustomobject]@{path=$p;bytes=$f.Length;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant();mtime=$f.LastWriteTimeUtc.ToString('o')}
})
New-Receipt 'cache-cleanup-plan-01.json' @{observedAt=[DateTime]::UtcNow.ToString('o');authority='Existing explicit user authorization to remove unused temporary/cache files';root=$taskRoot;scope='Five old regular ZIP download cache files only; no installed extensions, settings, profiles, source, test fixtures or evidence';files=$taskRows}
$taskDeleted=@(foreach($r in $taskRows){
 $f=Get-Item -LiteralPath $r.path;if($f.Length -ne $r.bytes -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-FileHash -LiteralPath $r.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $r.sha256){throw 'Cache changed'}
 Remove-Item -LiteralPath $r.path -Force
 if(Test-Path -LiteralPath $r.path){throw 'Removal incomplete'}
 $r
})
$taskDisk=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
New-Receipt 'cache-cleanup-result-01.json' @{status='ONLY_FIVE_OLD_DOWNLOAD_CACHE_FILES_REMOVED';observedAt=[DateTime]::UtcNow.ToString('o');files=$taskDeleted.Count;declaredBytes=($taskDeleted|Measure-Object bytes -Sum).Sum;freeBytes=$taskDisk.FreeSpace;signalsRequested=0;projectEvidenceInstalledExtensionsPreserved=$true}
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'cache-cleanup-result-01.json')
