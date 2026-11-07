# Fresh full03/compiler15/current990/driver04 binding. No historical native result transfer.
function Assert-F26AEditorHost {
 $taskFreshRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskFreshFacts=@'
[{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/post-full04-binding.json","bytes":1114,"sha256":"863608d4e9b80bbbefc754a7dc216d4ff2e5dc114f50cb231b98a3d70477917d"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-inputs-04.json","bytes":194634,"sha256":"49df8a06db5b5ae8f452b3608d5fd28fbf1d46132cddf00762b5f93a5504aeab"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/compiler-15.txt.result.json","bytes":577,"sha256":"9c1bbbc6c3f721c5bf3b3f945219b746a6db95c0fe8b3e8fbdea50df31e725b1"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/compiler-15.txt","bytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-tests-03.txt.result.json","bytes":609,"sha256":"8b668079b5d52a6acb166fc010483dd2fad82d86829147c84e0b8f9c622ef9b7"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-tests-03.txt","bytes":1018409,"sha256":"8940bea5855f499f351b67a7e71cb582980e488c143364b503119c97b6093f89"},{"path":"docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-driver-provenance-04.json","bytes":235767,"sha256":"ce1041b8c2b92b054e518d0980f14d15b1c407dd2b2e85ab0ff6641e84330af0"}]
'@|ConvertFrom-Json
 foreach($taskFreshFact in $taskFreshFacts){
  $taskFreshFile=Join-Path $taskFreshRepo $taskFreshFact.path
  if((Get-Item -LiteralPath $taskFreshFile).Length -ne $taskFreshFact.bytes -or (Get-FileHash -LiteralPath $taskFreshFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFreshFact.sha256){throw 'Fresh full03/compiler15/current990/driver04 binding changed.'}
 }
 $taskFreshProof=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFreshProof.fileCount -ne 990 -or @($taskFreshProof.files).Count -ne 990){throw 'Exact990 current files required.'}
 foreach($taskFreshInput in $taskFreshProof.files){
  $taskFreshFile=Join-Path $taskFreshRepo $taskFreshInput.path
  if((Get-Item -LiteralPath $taskFreshFile).Length -ne $taskFreshInput.bytes -or (Get-FileHash -LiteralPath $taskFreshFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFreshInput.sha256){throw 'Current full-tested input changed.'}
 }
 $taskFreshDrivers=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFreshDrivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskFreshDrivers.drivers).Count -ne 21 -or $taskFreshDrivers.inputProof.sha256 -cne '49df8a06db5b5ae8f452b3608d5fd28fbf1d46132cddf00762b5f93a5504aeab' -or $taskFreshDrivers.binding.sha256 -cne '863608d4e9b80bbbefc754a7dc216d4ff2e5dc114f50cb231b98a3d70477917d'){throw 'Fresh21 current drivers required.'}
 foreach($taskFreshDriver in $taskFreshDrivers.drivers){
  $taskFreshFile=Join-Path $PSScriptRoot $taskFreshDriver.path
  if((Get-Item -LiteralPath $taskFreshFile).Length -ne $taskFreshDriver.bytes -or (Get-FileHash -LiteralPath $taskFreshFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFreshDriver.sha256){throw 'Fresh driver output changed.'}
 }
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'd9d717381e385580012b2f96b5ca3de8803f4de7bfbf4b1f8b1e2cdc14bafbfe'){throw 'Fresh F26A installed-host review changed or remains unbound.'}
 $taskReview=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-version-review-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReview.status -cne 'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING' -or $taskReview.currentHost.version -cne '1.143.1'){throw 'Explicit reviewed host binding required.'}
 $taskHost=$taskReview.currentHost
 if($taskHost.executable.sha256 -cne '325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6' -or $taskHost.executable.bytes -ne 238249784){throw 'Current reviewed Code1.143.1 executable pin differs; stop for fresh inspection.'}
 if([IO.Path]::GetFullPath($taskHost.executable.path) -ine [IO.Path]::GetFullPath('C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe')){throw 'Fresh reviewed executable path differs.'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskHost.executable.path)){throw 'Requested Code path differs from the current reviewed host.'}
 if([Diagnostics.FileVersionInfo]::GetVersionInfo($taskHost.executable.path).ProductVersion -cne $taskHost.version){throw 'Reviewed editor version changed.'}
 foreach($taskRecord in @($taskHost.executable)+@($taskHost.applicationFiles)){
  if((Get-Item -LiteralPath $taskRecord.path).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskRecord.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Reviewed editor application/executable bytes changed.'}
 }
}
