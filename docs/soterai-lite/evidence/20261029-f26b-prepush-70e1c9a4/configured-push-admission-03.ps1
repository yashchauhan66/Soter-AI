# PREPARED TEXT ONLY. Materialization and exact binding review are separate.
Set-StrictMode -Version Latest
function Get-F26BSha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Assert-F26BFile([string]$File,[string]$Sha,[long]$Bytes=-1){
 if($Sha -cnotmatch '^[a-f0-9]{64}$' -or -not(Test-Path -LiteralPath $File -PathType Leaf)){throw 'Missing exact bound file.'}
 $taskItem=Get-Item -LiteralPath $File -Force
 if($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint -or ($Bytes -ge 0 -and $taskItem.Length -ne $Bytes) -or (Get-F26BSha $File) -cne $Sha){throw ('Bound file differs: '+$File)}
}
function Read-F26BJson([string]$File,[long]$Cap=1048576){if((Get-Item -LiteralPath $File).Length -gt $Cap){throw 'Metadata cap exceeded.'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8|ConvertFrom-Json}
function Resolve-F26BOwn([string]$Relative){
 $taskResolved=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Relative));if(-not $taskResolved.StartsWith($PSScriptRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Own binding escaped evidence root.'};return $taskResolved
}
function Resolve-F26BRepo([string]$Relative){
 $taskResolved=[IO.Path]::GetFullPath((Join-Path $taskRepo $Relative));if(-not $taskResolved.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Source binding escaped repository.'};return $taskResolved
}
function Assert-F26BOrdinary([string]$File){for($taskCursor=[IO.Path]::GetFullPath($File);;){$taskEntry=Get-Item -LiteralPath $taskCursor -Force;if($taskEntry.LinkType -in @('SymbolicLink','Junction')){throw 'Redirect input ancestry refused.'};$taskParent=Split-Path -Parent $taskCursor;if(-not $taskParent -or $taskParent -ceq $taskCursor){break};$taskCursor=$taskParent}}
function Assert-F26BOwnFact($Fact){$taskFile=Resolve-F26BOwn $Fact.path;Assert-F26BOrdinary $taskFile;Assert-F26BFile $taskFile $Fact.sha256 $Fact.bytes;return $taskFile}
function Assert-F26BAdmission([string]$File,[string]$ExpectedSha){
 Assert-F26BOrdinary $File;Assert-F26BFile $File $ExpectedSha
 $taskPushBinding=Read-F26BJson $File;$taskPushGuard=Assert-F26BOwnFact $taskPushBinding.guard
 if($taskPushBinding.guard.path -cne 'configured-push-readonly-admission-03.cjs'){throw 'Exact configured-push read-only guard required.'}
 $taskPushNode='C:\Program Files\nodejs\node.exe';Assert-F26BFile $taskPushNode 'c5ff4c736112dd483c750fd4149d30c8a116db1a49b8b3ec88be4b65e6c86c19' 85119640
 $taskPushAnswer=& $taskPushNode $taskPushGuard $ExpectedSha;if($LASTEXITCODE -ne 0){throw 'Configured-push read-only admission refused.'}
 $taskPushResult=$taskPushAnswer|ConvertFrom-Json;if($taskPushResult.status -cne 'F26B_CONFIGURED_LOCAL_PUSH8_PREPARED_NOT_AUTHORIZED_NOT_RUN' -or $taskPushResult.configuredPushBindingSha256 -cne $ExpectedSha -or $taskPushResult.plannedPushInvocations -ne 2 -or $taskPushResult.externalNetwork -ne $false){throw 'Exact bounded local configured-push admission required.'}
 return $taskPushResult
}
