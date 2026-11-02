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
$taskExpectedVsix='5dac9288fb259ad538ab751258f250d85a933bfb5bc8641dc32e54c01f6f047f'
$taskExpected='3524f4f234004d81924854c756330a5d1273e0251c524d1a31fa63c3b3c784b2'
$taskWorkerExpected='36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb'
$taskDriverExpected='8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced'
$taskCodeExpected='9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb'
$taskGitExpected='da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot);$taskHost=[IO.Path]::GetFullPath($HostTestsPath);$taskVsix=[IO.Path]::GetFullPath($VsixPath)
$taskGit='C:\Program Files\Git\cmd\git.exe'
$taskOfflineHelper=Join-Path $PSScriptRoot 'native09-offline-owner-01.cjs.txt'
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
# UNBOUND text-only successor helper custody. All future helpers require new exact-byte binding.
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-current-admission-01.cjs') '71caae8c07839edff9ee0f0dbd33362c2b68d2784830900851bcc93226ba6c7e' 15337
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-host-current-binding-01.ps1') 'c54d73a48cc9406d2b5f0002d05c26be1a73c6950f50786132253eb5b616d9d5' 1957
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-artifact-binding-01.ps1') 'b380369073e876f0b7e984680c4636332ea048f98c87eb86ef58eb515cf4b416' 4578
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/current-native-admission-05.cjs') '251638db0be53eb3e79f808316e08c9d192e0eca10741fbc8484fb8353f3e368' 8293
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-offline-owner-01.cjs.txt') '73317aa89fd8bcdc937f56d737656b2ee93fcab7127ec058a2be02945eb7941a' 14903
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/native-physical-admission-14.cjs') '6d8aba0bdc97360823f92af00ec5f27d5f05c27389214724e37d53a0e6b5a11d' 3547
foreach($taskInput in @($taskSource,$taskHost,$taskVsix)){
 if(-not $taskInput.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture input outside workspace.'};Assert-F26AOrdinary $taskInput
}
if($ExpectedVsixSha256.ToLowerInvariant() -cne $taskExpectedVsix -or $ExpectedBundleSha256.ToLowerInvariant() -cne $taskExpected){throw 'Only this exact new F26a artifact/frontend is admitted.'}
if($taskVsix -ine [IO.Path]::GetFullPath((Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f28-20261101-attempt01.vsix'))){throw 'Exact F26a attempt02 path required.'}
if($taskSource -ine [IO.Path]::GetFullPath((Join-Path $taskRepo 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/vsix-extracted-02/extension')) -or $taskHost -ine [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'))){throw 'Current exact extraction and prebuilt driver required.'}
Assert-F26AFile $taskVsix $taskExpectedVsix;Assert-F26AFile $taskHost $taskDriverExpected 74473
Assert-F26AFile $CodePath $taskCodeExpected 238751552;Assert-F26AFile $taskGit $taskGitExpected 46480
Assert-F26AFile (Join-Path $PSScriptRoot 'original-native34-freeze-01.json') '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a'
Assert-F26AFile (Join-Path $PSScriptRoot 'supplementary-precommit-driver-provenance-01.json') '2e454f5001d0c467c533f162e98c7360d70a677f75806acda713c2b6b5d7677e'
$taskSemanticFreeze=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'original-native34-freeze-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskSemanticFreeze.primary).Count -ne 30 -or @($taskSemanticFreeze.restart).Count -ne 4 -or $taskSemanticFreeze.sha256 -cne 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741'){throw 'Exact30+4 semantic fixture required.'}
Assert-F26AFile (Join-Path $taskRepo $taskSemanticFreeze.file) $taskSemanticFreeze.sha256 $taskSemanticFreeze.bytes
$taskProvenance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'supplementary-precommit-driver-provenance-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskSelectedDriver=@($taskProvenance.drivers|Where-Object{$_.path -ceq 'docs/soterai-lite/evidence/20261102-f26a-native09-preparation/supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'})
if($taskProvenance.status -cne 'F26A_CURRENT1076_SUPPLEMENTARY_DRIVER1_PREPARED_NOT_NATIVE_ACCEPTANCE' -or @($taskProvenance.drivers).Count -ne 1 -or $taskSelectedDriver.Count -ne 1 -or $taskSelectedDriver[0].sha256 -cne $taskDriverExpected){throw 'Current one supplementary driver provenance must bind this exact host.'}
. (Join-Path $PSScriptRoot 'native09-host-current-binding-01.ps1')
. (Join-Path $PSScriptRoot 'native09-artifact-binding-01.ps1')
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
Assert-F26AFile (Join-Path $PSScriptRoot 'native10-bootstrap-admission-01.cjs') 'cad98a3837803cc3e7d7ae88c6e35bf0ba92210c9a5d373f92d0fff8e34fc866' 1519
$taskBootstrapAdmission=Join-Path $PSScriptRoot 'native10-bootstrap-admission-01.cjs'
& 'C:\Program Files\nodejs\node.exe' $taskBootstrapAdmission
if($LASTEXITCODE -ne 0){throw 'Current JSON bootstrap admission failed before Code/profile/Git.'}
$taskOfflineExpected=Get-F26ASha $taskOfflineHelper;$taskLauncherExpected=Get-F26ASha $PSCommandPath
# Explicit previous USER_DEFERRED decision remains a gate. No materialization/launch without fresh approval.
Write-Output 'CURRENT_F26A_NATIVE11_PREAPPROVAL_PASS_NO_CODE_PROFILE_OR_GIT_LAUNCH'
