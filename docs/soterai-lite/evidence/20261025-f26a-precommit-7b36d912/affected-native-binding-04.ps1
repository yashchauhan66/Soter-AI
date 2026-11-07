if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26a affected04 PREPARED_NOT_BOUND; fresh990 full03/compiler15/build04/attempt02 facts required.'}
function Assert-F26A04Fact {
 param([Parameter(Mandatory=$true)][object]$Fact)
 $task04Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 if([string]::IsNullOrWhiteSpace([string]$Fact.path) -or [IO.Path]::IsPathRooted([string]$Fact.path) -or [string]$Fact.path -match '(^|[\\/])[.][.]([\\/]|$)' -or [string]$Fact.path -match '[\\:]'){throw 'Unsafe current04 fact path.'}
 $task04File=[IO.Path]::GetFullPath((Join-Path $task04Repo ([string]$Fact.path)))
 if(-not $task04File.StartsWith($task04Repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Current04 fact escaped explicit workspace.'}
 for($task04Cursor=$task04File;;$task04Cursor=Split-Path -Parent $task04Cursor){if((Get-Item -LiteralPath $task04Cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked current04 fact refused.'};if($task04Cursor -ieq $task04Repo){break}}
 $task04Item=Get-Item -LiteralPath $task04File
 if($task04Item.PSIsContainer -or $task04Item.Length -ne $Fact.bytes -or ([string]$Fact.sha256) -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $task04File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Fact.sha256){throw 'Exact current04 fact mismatch.'}
}
function Get-F26A04Binding {
 $task04File=Join-Path $PSScriptRoot 'affected-native-current-binding-04.json'
 if((Get-FileHash -LiteralPath $task04File -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'ea4591f4030e1e63295001e7573a440dfd48eb85bd77efb082ba5219b11b4c0b'){throw 'Root-reviewed current04 binding changed/unbound.'}
 $task04Binding=Get-Content -LiteralPath $task04File -Raw -Encoding UTF8|ConvertFrom-Json
 if($task04Binding.status -cne 'F26A_FRESH990_FULL_BUILD_ARTIFACT_BOUND_NATIVE_NOT_RUN' -or $task04Binding.feature -cne 'F26a' -or $task04Binding.fileCount -ne 990){throw 'Fresh990 current04 admission required; no prior result transfer.'}
 return $task04Binding
}
function Assert-F26A04Gate {
 param([Parameter(Mandatory=$true)][string]$Name,[Parameter(Mandatory=$true)][object]$Receipt)
 $task04Base='docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'
 if($Receipt.path -cne ($task04Base+$Name+'.txt.result.json')){throw 'Wrong current04 gate role/path.'}
 Assert-F26A04Fact $Receipt
 $task04Value=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 $task04Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $task04Raw=Join-Path $PSScriptRoot ($Name+'.txt');$task04Bytes=[IO.File]::ReadAllBytes($task04Raw)
 if($task04Value.exitCode -ne 0 -or [IO.Path]::GetFullPath([string]$task04Value.output) -ine [IO.Path]::GetFullPath($task04Raw) -or $task04Bytes -contains 0){throw 'Actual fresh current04 gate0/intact raw required.'}
 Assert-F26A04Fact @{path=($task04Base+$Name+'.txt');bytes=$task04Bytes.Length;sha256=([string]$task04Value.sha256).ToLowerInvariant()}
 return $task04Value
}
function Assert-F26AAffectedInputs {
 $task04Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'));$task04Base='docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/'
 $task04Binding=Get-F26A04Binding
 foreach($task04Fact in @($task04Binding.sourceProof,$task04Binding.postFullBinding,$task04Binding.driverProvenance,$task04Binding.vsix,$task04Binding.inspection,$task04Binding.hostBinding,$task04Binding.artifactBinding)){Assert-F26A04Fact $task04Fact}
 if($task04Binding.sourceProof.path -cne ($task04Base+'full-inputs-04.json') -or $task04Binding.sourceProof.sha256 -cne '49df8a06db5b5ae8f452b3608d5fd28fbf1d46132cddf00762b5f93a5504aeab' -or $task04Binding.postFullBinding.path -cne ($task04Base+'post-full04-binding.json') -or $task04Binding.driverProvenance.path -cne ($task04Base+'native-driver-provenance-04.json') -or $task04Binding.inspection.path -cne ($task04Base+'vsix-inspection-02.json')){throw 'Only exact current990/full03/build04/inspection02 facts admitted.'}
 if($task04Binding.hostBinding.path -cne ($task04Base+'host-current-binding-03.ps1') -or $task04Binding.artifactBinding.path -cne ($task04Base+'artifact-binding-02.ps1') -or $task04Binding.extensionRoot -cne ($task04Base+'vsix-extracted-02/extension')){throw 'Only new host03/artifact02/extraction02 admitted.'}
 $task04Vsix='packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt02.vsix'
 if($task04Binding.vsix.path -cne $task04Vsix -or $task04Binding.vsix.sha256 -ceq 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' -or [IO.Path]::GetFullPath($VsixPath) -ine [IO.Path]::GetFullPath((Join-Path $task04Repo $task04Vsix)) -or $ExpectedVsixSha256.ToLowerInvariant() -cne $task04Binding.vsix.sha256){throw 'Fresh attempt02 exact artifact required; no attempt01 borrowing.'}
 $task04Proof=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task04Proof.fileCount -ne 990 -or @($task04Proof.files).Count -ne 990){throw 'Exact990 current members required.'}
 $task04Seen=@{};foreach($task04Input in $task04Proof.files){if($task04Seen.ContainsKey($task04Input.path)){throw 'Duplicate/case-alias current04 membership.'};$task04Seen[$task04Input.path]=$true;Assert-F26A04Fact $task04Input}
 $task04Post=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'post-full04-binding.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task04Post.status -cne 'CURRENT_FULL03_COMPILER15_INPUTS04_BOUND' -or $task04Post.fileCount -ne 990 -or $task04Post.sourceProof.path -cne $task04Binding.sourceProof.path -or $task04Post.sourceProof.sha256 -cne $task04Binding.sourceProof.sha256 -or $task04Post.outputVsix -cne $task04Vsix){throw 'Current full03/compiler15 checked binding required.'}
 foreach($task04Field in @('compilerReceipt','fullReceipt')){if($task04Post.$task04Field.path -cne $task04Binding.$task04Field.path -or $task04Post.$task04Field.sha256 -cne $task04Binding.$task04Field.sha256){throw 'Current gates disagree with postfull04 binding.'}}
 $null=Assert-F26A04Gate -Name 'compiler-15' -Receipt $task04Binding.compilerReceipt
 $null=Assert-F26A04Gate -Name 'full-tests-03' -Receipt $task04Binding.fullReceipt
 $null=Assert-F26A04Gate -Name 'native-build-04' -Receipt $task04Binding.driverBuildReceipt
 $null=Assert-F26A04Gate -Name 'package-04' -Receipt $task04Binding.packageReceipt
 $null=Assert-F26A04Gate -Name 'backend-typecheck-04' -Receipt $task04Binding.backendCompilerReceipt
 $null=Assert-F26A04Gate -Name 'backend-tests-04' -Receipt $task04Binding.backendTestsReceipt
 $null=Assert-F26A04Gate -Name 'content-inspection-02' -Receipt $task04Binding.contentReceipt
 $task04Full=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'full-tests-03.txt'))
 foreach($task04Key in @('tests','pass','fail','cancelled','skipped')){$task04Matches=[regex]::Matches($task04Full,('(?m)^# '+$task04Key+' ([0-9]+)\r?$'));if($task04Matches.Count -ne 1 -or [long]$task04Matches[0].Groups[1].Value -ne $task04Post.expectedFullSummary.$task04Key){throw 'Fresh full03 actual TAP disagrees with bound summary.'}}
 $task04Stats=$task04Post.expectedFullSummary
 if($task04Stats.tests -lt 4223 -or $task04Stats.fail -ne 0 -or $task04Stats.cancelled -ne 0 -or $task04Stats.skipped -ne 4 -or ($task04Stats.pass+$task04Stats.skipped) -ne $task04Stats.tests){throw 'Fresh current990 full03 actual PASS required; no historical full02 admission.'}
 $task04Drivers=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task04Drivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($task04Drivers.drivers).Count -ne 21 -or $task04Drivers.inputProof.path -cne $task04Binding.sourceProof.path -or $task04Drivers.inputProof.sha256 -cne $task04Binding.sourceProof.sha256 -or $task04Drivers.inputProof.fileCount -ne 990 -or $task04Drivers.binding.sha256 -cne $task04Binding.postFullBinding.sha256 -or $task04Drivers.compiler.receipt.sha256 -cne $task04Binding.compilerReceipt.sha256 -or $task04Drivers.full.receipt.sha256 -cne $task04Binding.fullReceipt.sha256){throw 'Fresh21driver04/current990/currentfull03 provenance required.'}
 $task04Allowed=@();$task04Names=@{}
 foreach($task04Driver in $task04Drivers.drivers){if($task04Driver.path -cnotmatch '^prebuilt-native-hosts-04/lite-[a-z0-9-]+-host[.]js$'){throw 'Only fresh04 driver paths admitted.'};$task04Name=[IO.Path]::GetFileName($task04Driver.path);if($task04Names.ContainsKey($task04Name)){throw 'Duplicate current04 driver.'};$task04Names[$task04Name]=$true;Assert-F26A04Fact @{path=($task04Base+$task04Driver.path);bytes=$task04Driver.bytes;sha256=$task04Driver.sha256};$task04Allowed+=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $task04Driver.path))}
 $task04ExpectedNames=@('lite-precommit-guard-host.js','lite-logs-host.js','lite-log-vault-runtime-host.js','lite-vault-runtime-host.js','lite-streaming-output-host.js','lite-ps51-host.js','lite-cmd-host.js','lite-gitbash-host.js','lite-artifact-host.js','lite-history-host.js','lite-broker-host.js','lite-hygiene-host.js','lite-vault-host.js','lite-source-host.js','lite-container-host.js','lite-terraform-host.js','lite-registry-host.js','lite-service-account-host.js','lite-ci-host.js','lite-editor-host.js','lite-mcp-host.js')
 if((@($task04Names.Keys|Sort-Object)-join '|') -cne (@($task04ExpectedNames|Sort-Object)-join '|')){throw 'Exact21 current native driver membership required.'}
 foreach($task04Retained in @(@{name='retained-functional10-driver-01.js';bytes=532622;sha256='b64a85f99d9c5c3194b2bd427822116b7c59f8565dc3fc5477c27b92208a8b3b'},@{name='retained-security17-driver-01.js';bytes=13372;sha256='de3e734ece51d89adaa58caec792c5d39b142d9e88cd17b2cda312099d0d38c9'})){Assert-F26A04Fact @{path=($task04Base+$task04Retained.name);bytes=$task04Retained.bytes;sha256=$task04Retained.sha256};$task04Allowed+=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $task04Retained.name))}
 $task04Host=Get-Variable -Name HostTestsPath -ErrorAction SilentlyContinue
 if($task04Host -and ([string]::IsNullOrWhiteSpace([string]$task04Host.Value) -or $task04Allowed -inotcontains [IO.Path]::GetFullPath([string]$task04Host.Value))){throw 'Exact fresh04 or sealed functional/security driver required; no rebuild fallback.'}
 $task04Inspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($task04Inspection.status -cne 'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED' -or $task04Inspection.sha256 -cne $task04Binding.vsix.sha256 -or $task04Inspection.entryCount -ne 15 -or @($task04Inspection.entries).Count -ne 15 -or $task04Inspection.runtimeCount -ne 4 -or $task04Inspection.machineSettings -ne 82){throw 'Fresh attempt02 content15/runtime4/machine82 inspection required.'}
 foreach($task04Entry in $task04Inspection.entries){Assert-F26A04Fact @{path=($task04Base+'vsix-extracted-02/'+$task04Entry.path);bytes=$task04Entry.bytes;sha256=$task04Entry.sha256}}
 if(@($task04Binding.runtimeBindings).Count -ne 4){throw 'Exactly four fresh runtime bindings required.'}
 $task04RuntimeNames=@{};foreach($task04Runtime in $task04Binding.runtimeBindings){if($task04RuntimeNames.ContainsKey($task04Runtime.name) -or $task04Runtime.path -cne ($task04Base+'vsix-extracted-02/extension/dist/'+$task04Runtime.name)){throw 'Duplicate/noncanonical runtime binding.'};$task04RuntimeNames[$task04Runtime.name]=$true;Assert-F26A04Fact $task04Runtime;$task04Entry=@($task04Inspection.entries|Where-Object{$_.path -ceq ('extension/dist/'+$task04Runtime.name)});if($task04Entry.Count -ne 1 -or $task04Entry[0].bytes -ne $task04Runtime.bytes -or $task04Entry[0].sha256 -cne $task04Runtime.sha256){throw 'Current runtime differs from new sealed content.'}}
 if((@($task04RuntimeNames.Keys|Sort-Object)-join '|') -cne (@('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js'|Sort-Object)-join '|')){throw 'Exact four packaged runtime names required.'}
 $task04Frontend=@($task04Binding.runtimeBindings|Where-Object{$_.name -ceq 'extension.js'})[0]
 if($task04Frontend.sha256 -ceq 'f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184' -or $ExpectedBundleSha256.ToLowerInvariant() -cne $task04Frontend.sha256){throw 'Fresh corrected frontend required; attempt01 frontend cannot be reused.'}
 $task04Extension=Join-Path $task04Repo $task04Binding.extensionRoot;$task04Requested=Get-Variable -Name ExtensionRoot -ErrorAction SilentlyContinue
 if($task04Requested -and -not [string]::IsNullOrWhiteSpace([string]$task04Requested.Value) -and [IO.Path]::GetFullPath([string]$task04Requested.Value) -ine [IO.Path]::GetFullPath($task04Extension)){throw 'Only exact inspected02 extraction admitted.'}
 . (Join-Path $PSScriptRoot 'host-current-binding-03.ps1');. (Join-Path $PSScriptRoot 'artifact-binding-02.ps1')
 Assert-F26AEditorHost
 Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $task04Extension -ExpectedBundleSha256 $ExpectedBundleSha256
 $task04Manifest=Get-Content -LiteralPath (Join-Path $task04Extension 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if(@($task04Manifest.contributes.configuration.properties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'}).Count -ne 82 -or $task04Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.default -ne $false -or $task04Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.scope -cne 'machine'){throw 'Strict default-off machine precommit flag and82 settings required.'}
 Assert-F26A04Fact @{path='docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json';bytes=2571;sha256='c1cde060f5f062280b2e0961b49262569151ab716cf425b553363cb6f8646718'}
}
function Get-F26ARuntimeBindings {
 param([Parameter(Mandatory=$true)][string]$ExecutionRoot)
 Assert-F26AAffectedInputs;$task04Binding=Get-F26A04Binding;$task04Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 foreach($task04Runtime in $task04Binding.runtimeBindings){$task04Source=Join-Path $task04Repo $task04Runtime.path;$task04Execution=Join-Path $ExecutionRoot ('dist/'+$task04Runtime.name);if((Get-Item -LiteralPath $task04Execution).Length -ne $task04Runtime.bytes -or (Get-FileHash -LiteralPath $task04Execution -Algorithm SHA256).Hash.ToLowerInvariant() -cne $task04Runtime.sha256){throw 'Execution runtime differs from fresh attempt02 sealed bytes.'};@{name=$task04Runtime.name;bytes=$task04Runtime.bytes;sha256=$task04Runtime.sha256;source=$task04Source;execution=$task04Execution}}
}
