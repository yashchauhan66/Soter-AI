param(
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256,
 [ValidatePattern('^[0-9]{2}$')][string]$InspectionName='01'
)
# Execution creates new immutable content inspection/extraction evidence only.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRepoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskLiteRoot=Join-Path $taskRepoRoot 'packages/soterai-lite'
$taskVsix=[IO.Path]::GetFullPath($VsixPath)
if([IO.Path]::GetFileName($taskVsix) -notmatch '^soterai-lite-0\.7\.0-f22a-[0-9]{8}-attempt[0-9]{2}\.vsix$'){throw 'An explicitly named new F22a artifact is required.'}
$taskOutput=Join-Path $PSScriptRoot ('vsix-extracted-'+$InspectionName)
$taskReport=Join-Path $PSScriptRoot ('vsix-inspection-'+$InspectionName+'.json')
if((Test-Path -LiteralPath $taskOutput) -or (Test-Path -LiteralPath $taskReport)){throw 'Immutable extraction/inspection output already exists.'}
function Get-F22aSha([byte[]]$Bytes){
 $taskAlgorithm=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($taskAlgorithm.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()}finally{$taskAlgorithm.Dispose()}
}
function Read-F22aJson([string]$File){
 $taskData=[IO.File]::ReadAllBytes($File)
 return ([Text.UTF8Encoding]::new($false,$true).GetString($taskData)|ConvertFrom-Json)
}
function Assert-F22aContained([string]$Root,[string]$Target){
 $taskRootFull=[IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar)
 $taskTargetFull=[IO.Path]::GetFullPath($Target)
 if(-not $taskTargetFull.StartsWith($taskRootFull+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Metadata path escaped its declared root.'}
}
function Assert-F22aFile([string]$File,[long]$Bytes,[string]$Sha256){
 if($Sha256 -cnotmatch '^[a-f0-9]{64}$' -or -not(Test-Path -LiteralPath $File -PathType Leaf)){throw 'Expected hashed file unavailable.'}
 if((Get-Item -LiteralPath $File).Length -ne $Bytes -or (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Sha256){throw ('Hashed input differs: '+$File)}
}
function Assert-F22aManifest($Manifest){
 if($Manifest.name -cne 'soterai-ide-guard' -or $Manifest.publisher -cne 'soterai' -or $Manifest.version -cne '0.7.0' -or $Manifest.main -cne './dist/extension.js'){throw 'Unexpected packaged Lite identity.'}
 $taskProperties=$Manifest.contributes.configuration.properties
 $taskMachine=@($taskProperties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'})
 $taskFlag=$taskProperties.'soterai.lite.configScanner.source'
 if($taskMachine.Count -ne 71 -or $taskFlag.type -cne 'boolean' -or $taskFlag.default -ne $true -or $taskFlag.scope -cne 'machine'){throw 'F22a requires 71 machine settings and its default-true machine flag.'}
 if(@($Manifest.capabilities.untrustedWorkspaces.restrictedConfigurations|Where-Object{$_ -ceq 'soterai.lite.configScanner.source'}).Count -ne 1){throw 'F22a setting is not restricted in untrusted workspaces.'}
 foreach($taskCommand in @('soterai.reviewWorkspaceHygiene','soterai.reviewSelectedFileHygiene','soterai.reviewHygieneVault','soterai.generateHygieneEnvExample','soterai.restoreHygieneVault','soterai.openHygieneExposureLedger','soterai.exportHygieneExposureLedger','soterai.openHygieneRotationChecklist','soterai.hygieneStatus','soterai.reviewWorkspaceSourceSecrets','soterai.reviewSourceSecrets','soterai.reviewSourceSecretVault','soterai.restoreSourceSecretVault','soterai.sourceSecretScannerStatus')){
  if(@($Manifest.contributes.commands|Where-Object{$_.command -ceq $taskCommand}).Count -ne 1){throw ('Missing or duplicate F22a command: '+$taskCommand)}
 }
 $taskProfile=@($Manifest.contributes.terminal.profiles|Where-Object{$_.id -ceq 'soterai.gitbash.checked'})
 if($taskProfile.Count -ne 1 -or $taskProfile[0].title -cne 'SoterAI Git Bash (checked commands)'){throw 'Missing or duplicate F22a contributed profile.'}
 foreach($taskCommand in @('soterai.reviewWorkspaceHygiene','soterai.reviewSelectedFileHygiene','soterai.reviewHygieneVault','soterai.generateHygieneEnvExample','soterai.restoreHygieneVault','soterai.openHygieneExposureLedger','soterai.exportHygieneExposureLedger','soterai.openHygieneRotationChecklist','soterai.hygieneStatus','soterai.reviewWorkspaceSourceSecrets','soterai.reviewSourceSecrets','soterai.reviewSourceSecretVault','soterai.restoreSourceSecretVault','soterai.sourceSecretScannerStatus')){
  $taskGate=@($Manifest.contributes.menus.commandPalette|Where-Object{$_.command -ceq $taskCommand})
  if($taskGate.Count -ne 1 -or $taskGate[0].when -cne 'soterai.advancedCommands'){throw 'Missing F22a advanced command gate.'}
 }
 foreach($taskGroup in @('taskDefinitions','debuggers')){
  if(@($Manifest.contributes.$taskGroup|Where-Object{$_.type -ceq 'soterai-vault'}).Count -ne 1){throw 'Missing or duplicate soterai-vault task/debug type.'}
 }
}
Assert-F22aContained $taskLiteRoot $taskVsix
if(-not(Test-Path -LiteralPath $taskVsix -PathType Leaf)){throw 'Expected F22a VSIX is not built.'}
$taskVsixHash=(Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant()
$taskVsixBytes=(Get-Item -LiteralPath $taskVsix).Length
if($taskVsixHash -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Exact new VSIX SHA256 binding failed.'}
$taskReceiptPath=Join-Path $taskLiteRoot 'dist/build-receipt.json'
$taskReceiptBytes=[IO.File]::ReadAllBytes($taskReceiptPath)
$taskProvenance=Read-F22aJson $taskReceiptPath
if($taskProvenance.status -cne 'BUILT_NOT_HOST_VERIFIED' -or $taskProvenance.identity -cne 'soterai.soterai-ide-guard' -or $taskProvenance.version -cne '0.7.0' -or $taskProvenance.runtimeCount -ne 3 -or @($taskProvenance.inventory).Count -ne 3){throw 'Unexpected build provenance identity/count.'}
if([IO.Path]::IsPathRooted($taskProvenance.attempt) -or $taskProvenance.attempt -match '(^|[\\/])\.\.([\\/]|$)'){throw 'Invalid immutable build attempt path.'}
$taskAttempt=[IO.Path]::GetFullPath((Join-Path $taskLiteRoot $taskProvenance.attempt))
Assert-F22aContained (Join-Path $taskLiteRoot 'builds') $taskAttempt
$taskRetainedReceipt=Join-Path $taskAttempt 'build-provenance.json'
Assert-F22aFile $taskRetainedReceipt $taskReceiptBytes.Length (Get-F22aSha $taskReceiptBytes)
$taskAttemptManifest=Join-Path $taskAttempt 'package.json'
$taskAttemptManifestBytes=[IO.File]::ReadAllBytes($taskAttemptManifest)
Assert-F22aFile $taskAttemptManifest $taskAttemptManifestBytes.Length $taskProvenance.manifestSha256
Assert-F22aFile (Join-Path $taskLiteRoot 'package.json') $taskAttemptManifestBytes.Length $taskProvenance.manifestSha256
$taskCanonicalPath=Join-Path $taskRepoRoot 'packages/vscode-extension/package.json'
$taskCanonical=Read-F22aJson $taskCanonicalPath
$taskCanonicalSha=(Get-FileHash -LiteralPath $taskCanonicalPath -Algorithm SHA256).Hash.ToLowerInvariant()
$taskBuildManifest=Read-F22aJson $taskAttemptManifest
$taskPackageReceiptPath=Join-Path $taskAttempt 'package-receipt.json'
$taskPackageReceipt=Read-F22aJson $taskPackageReceiptPath
if($taskPackageReceipt.status -cne 'PACKAGED_NOT_HOST_VERIFIED' -or $taskPackageReceipt.runId -cne $taskProvenance.runId -or $taskPackageReceipt.sha256 -cne $taskVsixHash -or $taskPackageReceipt.bytes -ne $taskVsixBytes -or [IO.Path]::GetFullPath((Join-Path $taskRepoRoot $taskPackageReceipt.output)) -ine $taskVsix){throw 'Package receipt does not identify this exact VSIX.'}
$taskAllowed=@('[Content_Types].xml','extension.vsixmanifest','extension/package.json','extension/readme.md','extension/changelog.md','extension/LICENSE.md',
 'extension/dist/extension.js','extension/dist/local-ai-broker.js','extension/dist/soterai-mcp-server.js',
 'extension/media/icon.svg','extension/media/logo_circle_whiter.png','extension/media/walkthrough/demo.md',
 'extension/media/walkthrough/integrate.md','extension/media/walkthrough/vault.md')
$taskAllowedSet=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach($taskName in $taskAllowed){[void]$taskAllowedSet.Add($taskName)}
$taskSeen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$taskContents=@{};$taskEntries=@();$taskArchiveBytes=0L
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
try{
 foreach($taskEntry in $taskZip.Entries){
  $taskName=$taskEntry.FullName
  if(-not $taskAllowedSet.Contains($taskName) -or -not $taskSeen.Add($taskName) -or $taskName.Contains('..') -or $taskName.StartsWith('/') -or $taskName.Contains('\')){throw ('Unexpected or duplicate package entry: '+$taskName)}
  if($taskEntry.Length -lt 0 -or $taskEntry.Length -gt 8388608 -or (($taskEntry.ExternalAttributes -shr 16) -band 61440) -eq 40960){throw 'Oversized or symlink archive entry.'}
  $taskArchiveBytes+=$taskEntry.Length;if($taskArchiveBytes -gt 33554432){throw 'Archive expansion bound exceeded.'}
  $taskStream=$taskEntry.Open();$taskBuffer=New-Object IO.MemoryStream
  try{$taskStream.CopyTo($taskBuffer);$taskBytes=$taskBuffer.ToArray()}finally{$taskStream.Dispose();$taskBuffer.Dispose()}
  if($taskBytes.Length -ne $taskEntry.Length){throw 'Archive entry length changed.'}
  $taskContents[$taskName]=$taskBytes
  $taskEntries+=@{path=$taskName;bytes=$taskBytes.Length;sha256=(Get-F22aSha $taskBytes)}
 }
}finally{$taskZip.Dispose()}
if($taskEntries.Count -ne 14 -or $taskEntries.Count -ne $taskAllowed.Count){throw 'Exact 14-entry Lite inventory required.'}
$taskRuntimeNames=@('extension.js','local-ai-broker.js','soterai-mcp-server.js')
$taskSeenRuntimes=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$taskVerifiedInputs=@()
foreach($taskRuntime in $taskProvenance.inventory){
 if($taskRuntime.name -cnotin $taskRuntimeNames -or -not $taskSeenRuntimes.Add($taskRuntime.name) -or @($taskRuntime.inputs).Count -eq 0){throw 'Unexpected runtime or missing source inputs.'}
 $taskArchiveEntry=@($taskEntries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntime.name)})[0]
 if($taskArchiveEntry.sha256 -cne $taskRuntime.sha256 -or $taskArchiveEntry.bytes -ne $taskRuntime.bytes){throw 'Archive/runtime provenance differs.'}
 Assert-F22aFile (Join-Path $taskAttempt ('dist/'+$taskRuntime.name)) $taskRuntime.bytes $taskRuntime.sha256
 Assert-F22aFile (Join-Path $taskLiteRoot ('dist/'+$taskRuntime.name)) $taskRuntime.bytes $taskRuntime.sha256
 Assert-F22aFile (Join-Path $taskAttempt ('package/dist/'+$taskRuntime.name)) $taskRuntime.bytes $taskRuntime.sha256
 $taskInputNames=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($taskInput in $taskRuntime.inputs){
  $taskRelative=$taskInput.path.Replace('\','/')
  if([IO.Path]::IsPathRooted($taskRelative) -or $taskRelative -match '(^|/)\.\.(/|$)' -or -not $taskInputNames.Add($taskRelative)){throw 'Invalid or duplicate source input path.'}
  if($taskRelative -match 'apps/privacy-controller/|project-privacy/capabilities/|tier2-lite/|(^|/)(__tests__|fixtures|evidence|full-vm|full-controller)/'){throw 'Full/controller/test/evidence provenance refused.'}
  $taskInputPath=[IO.Path]::GetFullPath((Join-Path $taskRepoRoot $taskRelative));Assert-F22aContained $taskRepoRoot $taskInputPath
  Assert-F22aFile $taskInputPath $taskInput.bytes $taskInput.sha256
  $taskVerifiedInputs+=@{runtime=$taskRuntime.name;path=$taskRelative;bytes=$taskInput.bytes;sha256=$taskInput.sha256}
 }
}
if($taskSeenRuntimes.Count -ne 3 -or $taskPackageReceipt.extensionSha256 -cne @($taskProvenance.inventory|Where-Object{$_.name -ceq 'extension.js'})[0].sha256){throw 'Runtime identity receipt differs.'}
if(@($taskProvenance.inventory|Where-Object{$_.name -ceq 'extension.js'})[0].sha256 -cne $ExpectedBundleSha256.ToLowerInvariant()){throw 'Exact extracted extension runtime SHA256 binding failed.'}
$taskScannedText=@()
$taskForbiddenPaths=@($taskRepoRoot,$taskRepoRoot.Replace('\','\\'),[Environment]::GetFolderPath('UserProfile'),[Environment]::GetFolderPath('UserProfile').Replace('\','\\'),'D:\SoterAI-Lite-test-profiles','D:\\SoterAI-Lite-test-profiles')|Where-Object{$_ -and $_.Length -gt 3}|Select-Object -Unique
foreach($taskTextName in @($taskAllowed|Where-Object{$_ -notmatch '\.png$'})){
 $taskText=[Text.UTF8Encoding]::new($false,$true).GetString($taskContents[$taskTextName])
 foreach($taskForbiddenPath in $taskForbiddenPaths){if($taskText.IndexOf($taskForbiddenPath,[StringComparison]::OrdinalIgnoreCase) -ge 0){throw ('Local workspace/profile path found in '+$taskTextName)}}
 $taskScannedText+=@{path=$taskTextName;utf8=$true;localWorkspaceOrProfileMatches=0}
}
$taskManifestBytes=$taskContents['extension/package.json']
if((Get-F22aSha $taskManifestBytes) -cne $taskPackageReceipt.stagedManifestSha256){throw 'Packaged manifest hash differs from package receipt.'}
Assert-F22aFile (Join-Path $taskAttempt 'package/package.json') $taskManifestBytes.Length (Get-F22aSha $taskManifestBytes)
$taskManifest=[Text.UTF8Encoding]::new($false,$true).GetString($taskManifestBytes)|ConvertFrom-Json
Assert-F22aManifest $taskManifest
Assert-F22aManifest $taskBuildManifest
if($taskManifest.PSObject.Properties.Name -contains 'scripts' -or $taskManifest.PSObject.Properties.Name -contains 'devDependencies'){throw 'Development package metadata shipped.'}
foreach($taskField in @('contributes','activationEvents','capabilities')){
 $taskArchiveJson=$taskManifest.$taskField|ConvertTo-Json -Depth 80 -Compress
 $taskCanonicalJson=$taskCanonical.$taskField|ConvertTo-Json -Depth 80 -Compress
 if($taskArchiveJson -cne $taskCanonicalJson){throw ('Canonical/package metadata differs: '+$taskField)}
}
$taskAssetSources=@{'extension/readme.md'='README.md';'extension/changelog.md'='CHANGELOG.md';'extension/LICENSE.md'='LICENSE.md';
 'extension/media/icon.svg'='media/icon.svg';'extension/media/logo_circle_whiter.png'='media/logo_circle_whiter.png';
 'extension/media/walkthrough/demo.md'='media/walkthrough/demo.md';'extension/media/walkthrough/integrate.md'='media/walkthrough/integrate.md';'extension/media/walkthrough/vault.md'='media/walkthrough/vault.md'}
$taskAssets=@()
foreach($taskArchiveName in $taskAssetSources.Keys){
 $taskSourcePath=Join-Path $taskLiteRoot $taskAssetSources[$taskArchiveName];$taskSourceBytes=[IO.File]::ReadAllBytes($taskSourcePath);$taskSourceSha=Get-F22aSha $taskSourceBytes
 Assert-F22aFile (Join-Path $taskAttempt ('package/'+$taskAssetSources[$taskArchiveName])) $taskSourceBytes.Length $taskSourceSha
 $taskAssetEntry=@($taskEntries|Where-Object{$_.path -ceq $taskArchiveName})[0]
 $taskSame=$taskAssetEntry.sha256 -ceq $taskSourceSha
 if(-not $taskSame -and $taskArchiveName -cnotin @('extension/readme.md','extension/changelog.md')){throw 'Non-document asset changed in package.'}
 $taskAssets+=@{archivePath=$taskArchiveName;sourcePath=('packages/soterai-lite/'+$taskAssetSources[$taskArchiveName]);sourceBytes=$taskSourceBytes.Length;sourceSha256=$taskSourceSha;archiveSha256=$taskAssetEntry.sha256;bytesIdentical=$taskSame}
}
# Recheck all source inputs and artifact pointers after inventory collection.
foreach($taskInput in $taskVerifiedInputs){Assert-F22aFile (Join-Path $taskRepoRoot $taskInput.path) $taskInput.bytes $taskInput.sha256}
Assert-F22aFile $taskVsix $taskVsixBytes $taskVsixHash
Assert-F22aFile $taskReceiptPath $taskReceiptBytes.Length (Get-F22aSha $taskReceiptBytes)
if((Get-FileHash -LiteralPath $taskCanonicalPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskCanonicalSha){throw 'Canonical metadata changed during inspection.'}
foreach($taskEntry in $taskEntries){
 $taskTarget=[IO.Path]::GetFullPath((Join-Path $taskOutput $taskEntry.path));Assert-F22aContained $taskOutput $taskTarget
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskTarget))
 $taskWrite=[IO.File]::Open($taskTarget,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$taskData=$taskContents[$taskEntry.path];$taskWrite.Write($taskData,0,$taskData.Length);$taskWrite.Flush($true)}finally{$taskWrite.Dispose()}
 Assert-F22aFile $taskTarget $taskEntry.bytes $taskEntry.sha256
}
$taskInspection=@{status='PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED';vsix=$taskVsix;bytes=$taskVsixBytes;sha256=$taskVsixHash;
 entryCount=14;entries=$taskEntries;extractedExtensionRoot=(Join-Path $taskOutput 'extension');runtimeCount=3;forbiddenRuntimeInputs=0;verificationEvidenceShipped=$false;
 profileId='soterai.gitbash.checked';localPathScannedEntries=$taskScannedText;localPathScanScope='Exact current workspace/user-profile paths and isolated synthetic-profile prefix, literal and JavaScript-escaped; system executable paths are intentional';machineSettings=70;runtimeFlag='soterai.lite.configScanner.source';runtimeCommands=@('soterai.reviewWorkspaceHygiene','soterai.reviewSelectedFileHygiene','soterai.reviewHygieneVault','soterai.generateHygieneEnvExample','soterai.restoreHygieneVault','soterai.openHygieneExposureLedger','soterai.exportHygieneExposureLedger','soterai.openHygieneRotationChecklist','soterai.hygieneStatus','soterai.reviewWorkspaceSourceSecrets','soterai.reviewSourceSecrets','soterai.reviewSourceSecretVault','soterai.restoreSourceSecretVault','soterai.sourceSecretScannerStatus');taskType='soterai-vault';debugType='soterai-vault';
 buildReceiptSha256=(Get-F22aSha $taskReceiptBytes);packageReceiptSha256=(Get-FileHash -LiteralPath $taskPackageReceiptPath -Algorithm SHA256).Hash.ToLowerInvariant();
 canonicalManifestSha256=$taskCanonicalSha;packagedManifestSha256=(Get-F22aSha $taskManifestBytes);verifiedSourceInputCount=$taskVerifiedInputs.Count;verifiedSourceInputs=$taskVerifiedInputs;assetInputs=$taskAssets;
 sourceProvenance=$taskProvenance;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskInspection|ConvertTo-Json -Depth 30|Out-File -LiteralPath $taskReport -Encoding utf8 -NoClobber
$taskEntries|ForEach-Object{[pscustomobject]$_}|Format-Table path,bytes,sha256 -AutoSize
Write-Output ('VSIX SHA256: '+$taskVsixHash)
