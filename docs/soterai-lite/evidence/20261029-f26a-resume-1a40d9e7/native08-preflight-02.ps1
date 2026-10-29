param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
# PREPARED_NOT_EXECUTED. Every Code/Git launch is owned; no signals or pipe aborts.
$ErrorActionPreference='Stop'
$taskExpectedVsix='16b37a33f203158756f46b3effc54e4fbffdd1a1e2a679d8f239138e3f7d7c18'
$taskExpected='831acd4b52ba7ac888e1030b79f0ccf16956ff3f2efcd9e8f49cdff479e34a0a'
$taskWorkerExpected='67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449'
$taskDriverExpected='8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced'
$taskCodeExpected='325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6'
$taskGitExpected='da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot);$taskHost=[IO.Path]::GetFullPath($HostTestsPath);$taskVsix=[IO.Path]::GetFullPath($VsixPath)
$taskGit='C:\Program Files\Git\cmd\git.exe'
$taskOfflineHelper=Join-Path $PSScriptRoot 'precommit-offline-owner-01.cjs'
function Get-F26ASha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Assert-F26AFile([string]$File,[string]$Sha,[long]$Bytes=-1){
 if(-not(Test-Path -LiteralPath $File -PathType Leaf) -or (Get-F26ASha $File) -cne $Sha -or ($Bytes -ge 0 -and (Get-Item -LiteralPath $File).Length -ne $Bytes)){throw ('Pinned file differs: '+$File)}
}
function Write-F26ANewBytes([string]$File,[byte[]]$Bytes){
 $taskFd=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskFd.Write($Bytes,0,$Bytes.Length);$taskFd.Flush($true)}finally{$taskFd.Dispose()}
}
function Write-F26ANewJson([string]$File,[object]$Value){Write-F26ANewBytes $File ([Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 60)+[Environment]::NewLine))}
function Copy-F26ANew([string]$Source,[string]$Target){if(Test-Path -LiteralPath $Target){throw 'Existing evidence copy refused.'};[IO.File]::Copy($Source,$Target,$false)}
function Assert-F26AOrdinary([string]$File){
 $taskCursor=[IO.Path]::GetFullPath($File)
 if($taskCursor -ine $taskRepo -and -not $taskCursor.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture ancestry guard escaped workspace.'}
 while($taskCursor.Length -ge $taskRepo.Length){if((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked fixture input refused.'};$taskCursor=Split-Path -Parent $taskCursor}
}
# Additional exact helper custody before any helper invocation.
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/storage-current-admission-09.cjs') '67af1525d6ada1815b5e0c16fa635253dfdd03dcfe9d17720a848cfc21accb47' 8877
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/host-current-binding-08.ps1') '9c28c4505bf6dc8c286de660392b31b0d821e13c8716597e57ea7e4c6294dd01' 560
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/artifact-binding-08.ps1') 'ede7c06819fcd9b3ab6b8ad98f11cc99dd18c65f68a47d4c13a3e2f8fc2ed3a9' 4225
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/current-admission-01.cjs') 'd08a7dbff02038918fd62ae58c06bf4daeaddc358583ffb7a29c7190a1a06ce1' 3985
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/precommit-offline-owner-01.cjs') '3455e56138c1f0856b9374391686dfeae4d08c11fec143eeccff39907dece915' 14721
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f30-setup-verification-847d2f09/current-native-guard-02.cjs') '84421b6aba10fd2b72a7c2069e21d0537da84f4ca68a2b491ec6b86637503c83' 8259
foreach($taskInput in @($taskSource,$taskHost,$taskVsix)){
 if(-not $taskInput.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture input outside workspace.'};Assert-F26AOrdinary $taskInput
}
if($ExpectedVsixSha256.ToLowerInvariant() -cne $taskExpectedVsix -or $ExpectedBundleSha256.ToLowerInvariant() -cne $taskExpected){throw 'Only this exact new F26a artifact/frontend is admitted.'}
if($taskVsix -ine [IO.Path]::GetFullPath((Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261029-attempt02.vsix'))){throw 'Exact F26a attempt02 path required.'}
if($taskSource -ine [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'vsix-extracted-09/extension')) -or $taskHost -ine [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'prebuilt-native-hosts-09/lite-precommit-guard-host.js'))){throw 'Current exact extraction and prebuilt driver required.'}
Assert-F26AFile $taskVsix $taskExpectedVsix;Assert-F26AFile $taskHost $taskDriverExpected 74473
Assert-F26AFile $CodePath $taskCodeExpected 238249784;Assert-F26AFile $taskGit $taskGitExpected 46480
Assert-F26AFile (Join-Path $PSScriptRoot 'native-host-freeze-02.json') '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a'
Assert-F26AFile (Join-Path $PSScriptRoot 'native-driver-provenance-09.json') '6009609cebcb75e194eda092666ff920ad2f4e76ceda6457a3c0232d1491415e'
$taskSemanticFreeze=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-host-freeze-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskSemanticFreeze.primary).Count -ne 30 -or @($taskSemanticFreeze.restart).Count -ne 4 -or $taskSemanticFreeze.sha256 -cne 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741'){throw 'Exact30+4 semantic fixture required.'}
Assert-F26AFile (Join-Path $taskRepo $taskSemanticFreeze.file) $taskSemanticFreeze.sha256 $taskSemanticFreeze.bytes
$taskProvenance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-09.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskSelectedDriver=@($taskProvenance.drivers|Where-Object{$_.path -ceq 'prebuilt-native-hosts-09/lite-precommit-guard-host.js'})
if($taskProvenance.status -cne 'BUILT_CURRENT1037_DRIVERS25_NOT_NATIVE_ACCEPTANCE' -or @($taskProvenance.drivers).Count -ne 25 -or $taskSelectedDriver.Count -ne 1 -or $taskSelectedDriver[0].sha256 -cne $taskDriverExpected){throw 'Current21-driver provenance must bind this exact host.'}
. (Join-Path $PSScriptRoot 'host-current-binding-08.ps1')
. (Join-Path $PSScriptRoot 'artifact-binding-08.ps1')
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
$taskOfflineExpected=Get-F26ASha $taskOfflineHelper;$taskLauncherExpected=Get-F26ASha $PSCommandPath
# Explicit previous USER_DEFERRED decision remains a gate. No materialization/launch without fresh approval.
$taskApprovalFile=Join-Path $PSScriptRoot 'native08-user-approval-01.json'
if(-not(Test-Path -LiteralPath $taskApprovalFile -PathType Leaf)){throw 'F26a native06 remains USER_DEFERRED: explicit fresh approval required'}
$taskApproval=Get-Content -LiteralPath $taskApprovalFile -Raw -Encoding UTF8|ConvertFrom-Json
if($taskApproval.status -cne 'EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE08' -or $taskApproval.allowedAttempts -ne 1 -or -not $taskApproval.replyId -or $taskApproval.candidateSha256 -cne (Get-F26ASha (Join-Path $PSScriptRoot 'native08-candidate-01.ps1.txt')) -or $taskApproval.proposalSha256 -cne (Get-F26ASha (Join-Path $PSScriptRoot 'NATIVE08-STORAGE-FIX-PROPOSAL01.md'))){throw 'Exact fresh native06 user approval does not bind this packet'}
Write-Output 'CURRENT_PROVENANCE_AND_ALL_PRECONSUMPTION_GATES_PASS_NO_NATIVE_LAUNCH'
