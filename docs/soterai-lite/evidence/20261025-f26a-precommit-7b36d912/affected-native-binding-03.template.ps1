if('__F26A_AFFECTED03_BOUND__' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26a affected03 PREPARED_NOT_BOUND; current fixture/build equivalence required.'}
function Assert-F26A03Fact {
 param([Parameter(Mandatory=$true)][object]$Fact)
 $task03Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 if([IO.Path]::IsPathRooted([string]$Fact.path) -or [string]$Fact.path -match '(^|[\\/])[.][.]([\\/]|$)'){throw 'Unsafe current03 fact path.'}
 $task03File=[IO.Path]::GetFullPath((Join-Path $task03Repo ([string]$Fact.path)))
 if(-not $task03File.StartsWith($task03Repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Current03 fact escaped explicit workspace.'}
 # Do not traverse the repository's Desktop/OneDrive ancestors. The explicit
 # workspace and every ancestor INSIDE it are the reviewed custody boundary.
 $task03Cursor=$task03File
 while($task03Cursor.Length -ge $task03Repo.Length){
  if((Get-Item -LiteralPath $task03Cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked current03 fact refused.'}
  if($task03Cursor -ieq $task03Repo){break};$task03Cursor=Split-Path -Parent $task03Cursor
 }
 $task03Item=Get-Item -LiteralPath $task03File
 if($task03Item.PSIsContainer -or $task03Item.Length -ne $Fact.bytes -or ([string]$Fact.sha256) -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $task03File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Fact.sha256){throw 'Exact current03 fact mismatch.'}
}
function Assert-F26AAffectedInputs {
 $task03Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 . (Join-Path $PSScriptRoot 'host-current-binding-02.ps1')
 . (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
 Assert-F26AEditorHost
 if($ExpectedVsixSha256.ToLowerInvariant() -cne 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' -or $ExpectedBundleSha256.ToLowerInvariant() -cne 'f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184'){throw 'Exact unchanged F26a VSIX/frontend required.'}
 $task03Vsix='packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix'
 if([IO.Path]::GetFullPath($VsixPath) -ine [IO.Path]::GetFullPath((Join-Path $task03Repo $task03Vsix))){throw 'No artifact substitution.'}
 $task03BindingFile=Join-Path $PSScriptRoot 'native-current-binding-03.json'
 if((Get-FileHash -LiteralPath $task03BindingFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F26A_NATIVE_CURRENT03_SHA256__'){throw 'Root current03 binding changed/unbound.'}
 $task03Binding=Get-Content -LiteralPath $task03BindingFile -Raw -Encoding UTF8|ConvertFrom-Json
 if($task03Binding.status -cne 'NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED' -or $task03Binding.unchangedOtherInputs -ne 988 -or $task03Binding.unchangedAffectedDrivers -ne 20 -or $task03Binding.changedFixture -cne 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts'){throw 'Explicit one-fixture-only current03 equivalence required.'}
 foreach($task03Fact in @($task03Binding.sourceProof,$task03Binding.fullSourceProof,$task03Binding.fullReceipt,$task03Binding.compilerReceipt,$task03Binding.driverProvenance,$task03Binding.vsix,$task03Binding.equivalence,$task03Binding.hostBinding)){Assert-F26A03Fact $task03Fact}
 if($task03Binding.sourceProof.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-source-inputs-03.json' -or $task03Binding.sourceProof.sha256 -cne 'f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab' -or $task03Binding.fullSourceProof.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-inputs-02.json' -or $task03Binding.fullSourceProof.sha256 -cne '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322'){throw 'Exact native03 and historical full02 proof identities required.'}
 if($task03Binding.fullReceipt.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/full-tests-02.txt.result.json' -or $task03Binding.fullReceipt.sha256 -cne '2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859' -or $task03Binding.compilerReceipt.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/compiler-14.txt.result.json' -or $task03Binding.compilerReceipt.sha256 -cne '4f78702568234099b8b827d30b929208c4c58b2464482f6ce22cfbb0bf5d8ddd'){throw 'Historical full02/fresh compiler14 actual receipts required.'}
 if($task03Binding.driverProvenance.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-driver-provenance-03.json' -or $task03Binding.driverProvenance.sha256 -cne 'a0889724025f85fdd8fc9705f9c19c55ccbb4b36bdde44510500e41212c3c33c' -or $task03Binding.vsix.path -cne $task03Vsix -or $task03Binding.vsix.sha256 -cne 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91'){throw 'Fresh03 driver provenance and unchanged sealed artifact required.'}
 if($task03Binding.equivalence.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-fixture-equivalence-03.json' -or $task03Binding.equivalence.sha256 -cne '837236c08710d3583eca0349dff7c93078ee3e2c1990b8233e06ea166dc0a20d' -or $task03Binding.hostBinding.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/host-current-binding-02.ps1' -or $task03Binding.hostBinding.sha256 -cne '8468eff27ee910978aa7d6a9fba10dc4c387631fd39ffa84580a6d1119390fc2'){throw 'Exact root equivalence03 and host02 facts required.'}
 $task03Equivalence=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-fixture-equivalence-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task03Equivalence.status -cne 'NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED' -or $task03Equivalence.changedFixture -cne $task03Binding.changedFixture -or $task03Equivalence.unchangedOtherInputs -ne 988 -or $task03Equivalence.unchangedAffectedDrivers -ne 20 -or @($task03Equivalence.equality).Count -ne 20){throw 'Exact one-fixture/20-driver root equivalence required.'}
 foreach($task03BuildFact in @($task03Equivalence.build.raw,$task03Equivalence.build.receipt)){Assert-F26A03Fact $task03BuildFact}
 if($task03Equivalence.build.raw.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-build-03.txt' -or $task03Equivalence.build.receipt.path -cne 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/native-build-03.txt.result.json'){throw 'Fresh build03 actual gate required.'}
 $task03BuildResult=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-build-03.txt.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task03BuildResult.exitCode -ne 0 -or ([string]$task03BuildResult.sha256).ToLowerInvariant() -cne $task03Equivalence.build.raw.sha256){throw 'Fresh build03 actual0/exact raw required.'}
 foreach($task03Gate in @('full-tests-02.txt','compiler-14.txt')){
  $task03Receipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($task03Gate+'.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
  if($task03Receipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $task03Gate) -Algorithm SHA256).Hash.ToLowerInvariant() -cne ([string]$task03Receipt.sha256).ToLowerInvariant()){throw 'Actual0 and exact raw current/reused gate required.'}
 }
 $task03Old=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $task03New=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-source-inputs-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task03Old.fileCount -ne 989 -or $task03New.fileCount -ne 989 -or @($task03Old.files).Count -ne 989 -or @($task03New.files).Count -ne 989 -or $task03New.status -cne 'NATIVE_ONLY_FIXTURE_CORRECTED_INPUT_PROOF_NOT_NEW_FULL_EXECUTION' -or $task03New.allowedNativeOnlyDelta -cne $task03Binding.changedFixture -or $task03New.unchangedFullInputs -ne 988){throw 'Exact989/988 fixture-only proof required; no new full execution claim.'}
 $task03Seen=@{};$task03Changes=@()
 foreach($task03Input in $task03New.files){
  if($task03Seen.ContainsKey($task03Input.path)){throw 'Duplicate current source membership.'};$task03Seen[$task03Input.path]=$true
  $task03Prior=@($task03Old.files|Where-Object{$_.path -ceq $task03Input.path})
  if($task03Prior.Count -ne 1){throw 'Current source membership differs from historical full02.'}
  if($task03Prior[0].bytes -ne $task03Input.bytes -or $task03Prior[0].sha256 -cne $task03Input.sha256){$task03Changes+=$task03Input.path}
  Assert-F26A03Fact $task03Input
 }
 if($task03Changes.Count -ne 1 -or $task03Changes[0] -cne $task03Binding.changedFixture){throw 'Only the exact one native fixture may differ from full02.'}
 $task03Before='docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/litePreCommitGuard.host.ts.before-CodeExpectedError-01.txt'
 $task03BeforeFact=@($task03Old.files|Where-Object{$_.path -ceq $task03Binding.changedFixture})[0]
 Assert-F26A03Fact @{path=$task03Before;bytes=$task03BeforeFact.bytes;sha256=$task03BeforeFact.sha256}
 $task03Utf8=[Text.UTF8Encoding]::new($false,$true)
 $task03BeforeText=$task03Utf8.GetString([IO.File]::ReadAllBytes((Join-Path $task03Repo $task03Before)))
 $task03AfterText=$task03Utf8.GetString([IO.File]::ReadAllBytes((Join-Path $task03Repo $task03Binding.changedFixture)))
 if(($task03BeforeText.Split(@('"ExpectedError"'),[StringSplitOptions]::None).Count-1) -ne 1 -or $task03BeforeText.Replace('"ExpectedError"','"CodeExpectedError"') -cne $task03AfterText){throw 'Fixture correction must be exactly the one error-name literal; no oracle/source relaxation.'}
 if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-02.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6'){throw 'Old built driver basis changed.'}
 $task03OldDrivers=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $task03Drivers=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-03.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task03Drivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($task03Drivers.drivers).Count -ne 21 -or @($task03OldDrivers.drivers).Count -ne 21 -or $task03Drivers.inputProof.path -cne $task03Binding.sourceProof.path -or $task03Drivers.inputProof.sha256 -cne $task03Binding.sourceProof.sha256 -or $task03Drivers.inputProof.fileCount -ne 989){throw 'Fresh exact21-driver03 build against current989 required.'}
 $task03Allowed=@();$task03Names=@{};$task03EqualAffected=0;$task03ChangedOwned=0
 foreach($task03Driver in $task03Drivers.drivers){
  if($task03Driver.path -cnotmatch '^prebuilt-native-hosts-03/lite-[a-z0-9-]+-host[.]js$'){throw 'Only current prebuilt03 driver outputs admitted.'}
  $task03Name=[IO.Path]::GetFileName($task03Driver.path);if($task03Names.ContainsKey($task03Name)){throw 'Duplicate current driver.'};$task03Names[$task03Name]=$true
  Assert-F26A03Fact @{path=('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'+$task03Driver.path);bytes=$task03Driver.bytes;sha256=$task03Driver.sha256}
  $task03Previous=@($task03OldDrivers.drivers|Where-Object{[IO.Path]::GetFileName($_.path) -ceq $task03Name})
  if($task03Previous.Count -ne 1){throw 'Current driver membership differs from original21.'}
  Assert-F26A03Fact @{path=('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'+$task03Previous[0].path);bytes=$task03Previous[0].bytes;sha256=$task03Previous[0].sha256}
  if($task03Name -ceq 'lite-precommit-guard-host.js'){
   if($task03Previous[0].sha256 -ceq $task03Driver.sha256){throw 'Changed fixture must have a freshly distinct compiled driver.'};$task03ChangedOwned++
  }else{
   if($task03Previous[0].bytes -ne $task03Driver.bytes -or $task03Previous[0].sha256 -cne $task03Driver.sha256){throw 'Every other20 native driver must remain byte exact.'};$task03EqualAffected++
  }
  $task03Allowed+=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $task03Driver.path))
 }
 if($task03EqualAffected -ne 20 -or $task03ChangedOwned -ne 1){throw 'Exactly20 unchanged affected drivers plus one corrected owner driver required.'}
 foreach($task03Retained in @(@{name='retained-functional10-driver-01.js';bytes=532622;sha256='b64a85f99d9c5c3194b2bd427822116b7c59f8565dc3fc5477c27b92208a8b3b'},@{name='retained-security17-driver-01.js';bytes=13372;sha256='de3e734ece51d89adaa58caec792c5d39b142d9e88cd17b2cda312099d0d38c9'})){
  Assert-F26A03Fact @{path=('docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'+$task03Retained.name);bytes=$task03Retained.bytes;sha256=$task03Retained.sha256};$task03Allowed+=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $task03Retained.name))
 }
 $task03Host=Get-Variable -Name HostTestsPath -ErrorAction SilentlyContinue
 if($task03Host -and ([string]::IsNullOrWhiteSpace([string]$task03Host.Value) -or $task03Allowed -inotcontains [IO.Path]::GetFullPath([string]$task03Host.Value))){throw 'Exact prebuilt03 or sealed functional/security driver required; no rebuild fallback.'}
 $task03Extension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension';$task03Requested=Get-Variable -Name ExtensionRoot -ErrorAction SilentlyContinue
 if($task03Requested -and -not [string]::IsNullOrWhiteSpace([string]$task03Requested.Value)){$task03Extension=[IO.Path]::GetFullPath([string]$task03Requested.Value)}
 Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $task03Extension -ExpectedBundleSha256 $ExpectedBundleSha256
 if((Get-FileHash -LiteralPath (Join-Path $task03Extension 'dist/pre-commit-client.js') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449'){throw 'Exact unchanged fourth worker required.'}
 $task03Manifest=Get-Content -LiteralPath (Join-Path $task03Extension 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if(@($task03Manifest.contributes.configuration.properties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'}).Count -ne 82 -or $task03Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.default -ne $false -or $task03Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.scope -cne 'machine'){throw 'Four-runtime/82-machine default-off artifact required.'}
 if((Get-FileHash -LiteralPath (Join-Path $task03Repo 'docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json') -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'c1cde060f5f062280b2e0961b49262569151ab716cf425b553363cb6f8646718'){throw 'Retained security baseline bytes changed.'}
}
function Get-F26ARuntimeBindings {
 param([Parameter(Mandatory=$true)][string]$ExecutionRoot)
 Assert-F26AAffectedInputs
 $task03Source=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 foreach($task03Name in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){
  $task03Original=Join-Path $task03Source ('dist/'+$task03Name);$task03Execution=Join-Path $ExecutionRoot ('dist/'+$task03Name)
  $task03Sha=(Get-FileHash -LiteralPath $task03Original -Algorithm SHA256).Hash.ToLowerInvariant();$task03Bytes=(Get-Item -LiteralPath $task03Original).Length
  if((Get-Item -LiteralPath $task03Execution).Length -ne $task03Bytes -or (Get-FileHash -LiteralPath $task03Execution -Algorithm SHA256).Hash.ToLowerInvariant() -cne $task03Sha){throw 'Actual execution runtime differs from exact unchanged sealed artifact.'}
  @{name=$task03Name;bytes=$task03Bytes;sha256=$task03Sha;source=$task03Original;execution=$task03Execution}
 }
}
