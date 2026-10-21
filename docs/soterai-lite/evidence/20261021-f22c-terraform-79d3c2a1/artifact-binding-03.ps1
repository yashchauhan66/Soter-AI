# Read-only explicit artifact/runtime binding shared by the affected-host launchers.
function Assert-F15bRuntimeBinding {
 param(
  [Parameter(Mandatory=$true)][string]$VsixPath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
  [Parameter(Mandatory=$true)][string]$ExtensionRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
 )
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
 if([IO.Path]::GetFileName($taskBindingVsix) -notmatch '^soterai-lite-0\.7\.0-f22c-[0-9]{8}-attempt[0-9]{2}\.vsix$' -or -not(Test-Path -LiteralPath $taskBindingVsix -PathType Leaf)){throw 'An explicit new F22c VSIX is required.'}
 if((Get-FileHash -LiteralPath $taskBindingVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Exact F15b artifact hash mismatch.'}
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $taskBindingZip=[IO.Compression.ZipFile]::OpenRead($taskBindingVsix)
 try{
  foreach($taskBindingName in @('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js')){
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
