$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskOutput=Join-Path $PSScriptRoot 'availability-01.json'
if(Test-Path -LiteralPath $taskOutput){throw 'Immutable availability evidence exists.'}
$taskCommands=@(foreach($taskName in @('pwsh.exe','pwsh')){Get-Command -Name $taskName -CommandType Application -All -ErrorAction SilentlyContinue | ForEach-Object {$_.Source}})|Sort-Object -Unique
$taskCandidates=@($taskCommands)
foreach($taskBase in @($env:ProgramFiles,${env:ProgramFiles(x86)})){
 if($taskBase){foreach($taskVersion in @('7','7-preview')){$taskCandidates+=Join-Path $taskBase ('PowerShell/'+$taskVersion+'/pwsh.exe')}}
}
if($env:LOCALAPPDATA){
 foreach($taskRelative in @('Programs/PowerShell/7/pwsh.exe','Microsoft/PowerShell/7/pwsh.exe','Microsoft/WindowsApps/pwsh.exe')){$taskCandidates+=Join-Path $env:LOCALAPPDATA $taskRelative}
}
$taskRows=@(foreach($taskCandidate in @($taskCandidates|Sort-Object -Unique)){
 $taskFull=[IO.Path]::GetFullPath($taskCandidate)
 $taskExists=Test-Path -LiteralPath $taskFull -PathType Leaf
 if($taskExists){
  $taskInfo=Get-Item -LiteralPath $taskFull -Force
  $taskAlias=($taskInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  @{path=$taskFull;exists=$true;bytes=$taskInfo.Length;reparsePoint=$taskAlias;executed=$false;
    sha256=$(if(-not $taskAlias -and $taskInfo.Length -gt 0){(Get-FileHash -LiteralPath $taskFull -Algorithm SHA256).Hash.ToLowerInvariant()}else{$null});
    productVersion=$(if(-not $taskAlias -and $taskInfo.Length -gt 0){$taskInfo.VersionInfo.ProductVersion}else{$null})}
 }else{@{path=$taskFull;exists=$false;executed=$false}}
})
$taskCatalog=Join-Path $taskRepo 'docs/soterai-lite/LITE-CATALOG.json'
$taskArtifact=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f10-20261017-attempt03.vsix'
$taskFound=@($taskRows|Where-Object {$_.exists})
$taskRecord=@{schemaVersion=1;feature='F11';observedAt=[DateTime]::UtcNow.ToString('o');applicationCommandNames=@('pwsh.exe','pwsh');pathCommandHits=@($taskCommands);candidates=$taskRows;
 status=$(if($taskFound.Count -eq 0){'NOT_TESTED_NOT_COVERED_OPTIONAL_UNAVAILABLE'}else{'CANDIDATE_REQUIRES_SEPARATE_F11_GATES'});
 executedRuntime=$false;productionChanged=$false;catalogSha256=(Get-FileHash -LiteralPath $taskCatalog -Algorithm SHA256).Hash.ToLowerInvariant();
 artifactPath='packages/soterai-lite/soterai-lite-0.7.0-f10-20261017-attempt03.vsix';artifactSha256=(Get-FileHash -LiteralPath $taskArtifact -Algorithm SHA256).Hash.ToLowerInvariant();
 scope='Application discovery and explicit standard locations only; not a disk-wide absence proof. No alias/runtime execution, download, login, profile or OS change.'}
$taskRecord|ConvertTo-Json -Depth 6|Out-File -LiteralPath $taskOutput -Encoding utf8 -NoClobber
$taskRecord|ConvertTo-Json -Depth 6
if($taskFound.Count){exit 2}
