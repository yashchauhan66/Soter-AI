$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
$taskOld=Get-Content -LiteralPath (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261021-f22g-editor-config-5d7a91c3/vsix-inspection-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskNew=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskOut=Join-Path $PSScriptRoot 'runtime-comparison-01'
if(Test-Path -LiteralPath $taskOut){throw 'Runtime comparison archive exists.'}
[void][IO.Directory]::CreateDirectory($taskOut)
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach($taskPair in @(@{name='previous';inspection=$taskOld},@{name='current';inspection=$taskNew})){
 $taskVsix=$taskPair.inspection.vsix
 if(-not ([IO.Path]::GetFullPath($taskVsix)).StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Artifact outside workspace.'}
 if((Get-FileHash -LiteralPath $taskVsix -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskPair.inspection.sha256){throw 'Exact comparison VSIX changed.'}
 $taskZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
 try{
  foreach($taskName in @('local-ai-broker.js','soterai-mcp-server.js')){
   $taskEntries=@($taskZip.Entries|Where-Object{$_.FullName -ceq ('extension/dist/'+$taskName)})
   if($taskEntries.Count -ne 1){throw 'Unique runtime entry required.'}
   $taskInput=$taskEntries[0].Open()
   $taskOutput=[IO.File]::Open((Join-Path $taskOut ($taskPair.name+'-'+$taskName+'.txt')),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
   try{$taskInput.CopyTo($taskOutput)}finally{$taskOutput.Dispose();$taskInput.Dispose()}
  }
 }finally{$taskZip.Dispose()}
}
Write-Output 'PASS exact previous/current broker and MCP runtime archives retained; no execution or mutation.'
