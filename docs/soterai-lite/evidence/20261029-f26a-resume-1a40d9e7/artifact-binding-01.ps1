if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26A template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
# Read-only explicit artifact/runtime binding shared by the affected-host launchers.
function Assert-F15bRuntimeBinding {
 param(
  [Parameter(Mandatory=$true)][string]$VsixPath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
  [Parameter(Mandatory=$true)][string]$ExtensionRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
 )

# Explicit new product-fix artifact/full proof: all placeholders refuse execution.
if($ExpectedVsixSha256.ToLowerInvariant() -cne 'd06a8740074054db0512fe43fe7b7b4734c775f4133e716fe78cd41a744708f8' -or $ExpectedBundleSha256.ToLowerInvariant() -cne '70a0485db0b186a65b760995bed8ae7a2d4bdbd2ac4c0434e70d02c26f52f8d1'){throw 'Exact new attempt02 artifact/runtime facts required.'}
 $taskBindingRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskBindingVsix=[IO.Path]::GetFullPath($VsixPath);$taskBindingRoot=[IO.Path]::GetFullPath($ExtensionRoot)
 foreach($taskBindingTarget in @($taskBindingVsix,$taskBindingRoot)){
  if(-not $taskBindingTarget.StartsWith($taskBindingRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Artifact/runtime input escaped the workspace.'}
  $taskBindingCursor=$taskBindingTarget
  while($taskBindingCursor.Length -gt $taskBindingRepo.Length){
   if((Test-Path -LiteralPath $taskBindingCursor) -and ((Get-Item -LiteralPath $taskBindingCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Linked artifact/runtime input refused.'}
   $taskBindingCursor=Split-Path -Parent $taskBindingCursor
  }
 }
 if([IO.Path]::GetFullPath($taskBindingVsix) -ine [IO.Path]::GetFullPath((Join-Path $taskBindingRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261029-attempt01.vsix'))){throw 'Only the bound NEW F26A attempt02 artifact is admitted.'}
 if([IO.Path]::GetFileName($taskBindingVsix) -notmatch '^soterai-lite-0\.7\.0-f26a-[0-9]{8}-attempt[0-9]{2}\.vsix$' -or -not(Test-Path -LiteralPath $taskBindingVsix -PathType Leaf)){throw 'An explicit new F26A VSIX is required.'}
 if((Get-FileHash -LiteralPath $taskBindingVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Exact F15b artifact hash mismatch.'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $taskBindingZip=[IO.Compression.ZipFile]::OpenRead($taskBindingVsix)
 try{
  foreach($taskBindingName in @('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js','dist/pre-commit-client.js')){
   $taskBindingEntries=@($taskBindingZip.Entries|Where-Object{$_.FullName -ceq ('extension/'+$taskBindingName)})
   if($taskBindingEntries.Count -ne 1 -or $taskBindingEntries[0].Length -gt 8388608){throw 'Unique bounded artifact metadata/runtime entry required.'}
   $taskBindingStream=$taskBindingEntries[0].Open();$taskBindingBuffer=New-Object IO.MemoryStream
   try{$taskBindingStream.CopyTo($taskBindingBuffer);$taskBindingBytes=$taskBindingBuffer.ToArray()}finally{$taskBindingStream.Dispose();$taskBindingBuffer.Dispose()}
   $taskBindingAlgorithm=[Security.Cryptography.SHA256]::Create()
   try{$taskBindingSha=[BitConverter]::ToString($taskBindingAlgorithm.ComputeHash($taskBindingBytes)).Replace('-','').ToLowerInvariant()}finally{$taskBindingAlgorithm.Dispose()}
   $taskBindingFile=Join-Path $taskBindingRoot $taskBindingName
   if(-not(Test-Path -LiteralPath $taskBindingFile -PathType Leaf) -or (Get-FileHash -LiteralPath $taskBindingFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBindingSha){throw 'Extracted metadata/runtime differs from the explicit VSIX.'}
   if($taskBindingName -ceq 'dist/extension.js' -and $taskBindingSha -cne $ExpectedBundleSha256.ToLowerInvariant()){throw 'Explicit F15b extension runtime hash mismatch.'}
  }
 }finally{$taskBindingZip.Dispose()}
 if((Get-FileHash -LiteralPath $taskBindingVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Artifact changed during binding.'}
}
