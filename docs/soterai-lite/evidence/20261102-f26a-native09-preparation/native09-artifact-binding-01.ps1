# Read-only exact artifact/runtime binding. Original five-entry bounded ZIP
# comparison, ordinary workspace ancestry, pre/post archive digest and current
# physical/vendor admission remain mandatory. No launcher/profile or native run.
function Assert-F15bRuntimeBinding {
 param(
  [Parameter(Mandatory=$true)][string]$VsixPath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
  [Parameter(Mandatory=$true)][string]$ExtensionRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
 )
 if(-not(Get-Command -Name Get-F26ANative09Binding -CommandType Function -ErrorAction SilentlyContinue)){. (Join-Path $PSScriptRoot 'native09-host-current-binding-01.ps1')}
 $taskNative09Binding=Get-F26ANative09Binding
 if($ExpectedVsixSha256.ToLowerInvariant() -cne '5dac9288fb259ad538ab751258f250d85a933bfb5bc8641dc32e54c01f6f047f' -or $ExpectedBundleSha256.ToLowerInvariant() -cne '3524f4f234004d81924854c756330a5d1273e0251c524d1a31fa63c3b3c784b2'){throw 'Exact current F26a artifact/runtime facts required.'}
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
 if($taskBindingVsix -ine [IO.Path]::GetFullPath((Join-Path $taskBindingRepo $taskNative09Binding.vsix.path)) -or $taskBindingVsix -ine [IO.Path]::GetFullPath((Join-Path $taskBindingRepo 'packages/soterai-lite/soterai-lite-0.7.0-f28-20261101-attempt01.vsix'))){throw 'Only the exact current F28-tested artifact is admitted for F26a.'}
 if($taskBindingRoot -ine [IO.Path]::GetFullPath((Join-Path $taskBindingRepo $taskNative09Binding.extractedRoot))){throw 'Exact current inspected extraction is required.'}
 if([IO.Path]::GetFileName($taskBindingVsix) -cne 'soterai-lite-0.7.0-f28-20261101-attempt01.vsix' -or -not(Test-Path -LiteralPath $taskBindingVsix -PathType Leaf)){throw 'An explicit exact current VSIX is required.'}
 if((Get-FileHash -LiteralPath $taskBindingVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Exact artifact hash mismatch.'}
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
   if($taskBindingName -ceq 'dist/extension.js' -and $taskBindingSha -cne $ExpectedBundleSha256.ToLowerInvariant()){throw 'Explicit extension runtime hash mismatch.'}
  }
 }finally{$taskBindingZip.Dispose()}
 if((Get-FileHash -LiteralPath $taskBindingVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Artifact changed during binding.'}
}
