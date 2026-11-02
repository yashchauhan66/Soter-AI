$ErrorActionPreference='Stop'
$taskAdmissionRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
function Resolve-F28Repo([string]$Relative){$taskResolved=if([IO.Path]::IsPathRooted($Relative)){[IO.Path]::GetFullPath($Relative)}else{[IO.Path]::GetFullPath((Join-Path $taskAdmissionRepo $Relative))};if(-not $taskResolved.StartsWith($taskAdmissionRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Repo path escaped.'};return $taskResolved}
function Resolve-F28Own([string]$Relative){$taskResolved=if([IO.Path]::IsPathRooted($Relative)){[IO.Path]::GetFullPath($Relative)}elseif($Relative -match '^(docs|packages|apps|node_modules)[\/]'){Resolve-F28Repo $Relative}else{[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $Relative))};if(-not $taskResolved.StartsWith($PSScriptRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Evidence path escaped.'};return $taskResolved}
function Get-F28Sha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Assert-F28File([string]$File,[string]$Expected,[long]$Bytes=-1){if(-not(Test-Path -LiteralPath $File -PathType Leaf) -or (Get-F28Sha $File) -cne $Expected -or ($Bytes -ge 0 -and (Get-Item -LiteralPath $File).Length -ne $Bytes)){throw 'Pinned ordinary file differs.'}}
function Read-F28Json([string]$File,[long]$Maximum=4194304){if((Get-Item -LiteralPath $File).Length -gt $Maximum){throw 'Bounded JSON exceeded.'};return Get-Content -LiteralPath $File -Raw -Encoding UTF8|ConvertFrom-Json}
function Assert-F28Admission([string]$BindingFile,[string]$Expected){
 if($Expected -cnotmatch '^[a-f0-9]{64}$'){throw 'Exact binding SHA required.'};Assert-F28File $BindingFile $Expected
 $taskValue=Read-F28Json $BindingFile;$taskGuard=Resolve-F28Own $taskValue.guard.path
 if($taskValue.guard.path -cne 'current-native-admission-03.cjs'){throw 'Exact current F28 guard required.'};Assert-F28File $taskGuard $taskValue.guard.sha256 $taskValue.guard.bytes
 $taskNode='C:\Program Files\nodejs\node.exe';if($taskValue.physicalRuntime.path -cne $taskNode){throw 'Pinned Node runtime required.'};Assert-F28File $taskNode $taskValue.physicalRuntime.sha256 $taskValue.physicalRuntime.bytes
 $taskRaw=& $taskNode $taskGuard $Expected --emit-binding;if($LASTEXITCODE -ne 0){throw 'Exact Node physical/current/vendor admission refused.'};$taskValidated=($taskRaw -join [Environment]::NewLine)|ConvertFrom-Json
 if($taskValidated.status -cne 'F28_NATIVE30_FIRST_PACKET_PREPARED_NOT_RUN' -or $taskValidated.allowedAttempts -ne 1 -or $taskValidated.configuredPushAuthorized -ne $false){throw 'Current reviewed native30 packet required.'};return $taskValidated
}
