if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND'){throw 'F26A affected binding is PREPARED_NOT_BOUND.'}
function Assert-F26AAffectedInputs {
 $taskF26Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 . (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
 . (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
 Assert-F26AEditorHost
 if($ExpectedVsixSha256.ToLowerInvariant() -cne 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' -or $ExpectedBundleSha256.ToLowerInvariant() -cne 'f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184'){throw 'Only current exact F26a attempt01 artifact is admitted.'}
 if([IO.Path]::GetFullPath($VsixPath) -ine [IO.Path]::GetFullPath((Join-Path $taskF26Repo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix'))){throw 'No historical artifact substitution.'}
 foreach($taskF26Fact in @(
  @{name='full-inputs-02.json';sha256='5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322'},
  @{name='native-driver-provenance-02.json';sha256='fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6'},
  @{name='full-tests-02.txt.result.json';sha256='2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859'},
  @{name='compiler-13.txt.result.json';sha256='1a75c0077efb49a8f98d9f83c66211e2219e0562753aeae50dcafe65e9b310ea'})){
  if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $taskF26Fact.name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Fact.sha256){throw 'Current F26a proof bytes changed.'}
 }
 $taskF26Full=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskF26Full.fileCount -ne 989 -or @($taskF26Full.files).Count -ne 989){throw 'Current989 source input proof required.'}
 foreach($taskF26Gate in @('full-tests-02.txt','compiler-13.txt')){
  $taskF26Receipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskF26Gate+'.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
  if($taskF26Receipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $taskF26Gate) -Algorithm SHA256).Hash.ToLowerInvariant() -cne ([string]$taskF26Receipt.sha256).ToLowerInvariant()){throw 'Actual current gate exit/raw binding required.'}
 }
 $taskF26Provenance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskF26Provenance.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskF26Provenance.drivers).Count -ne 21 -or $taskF26Provenance.inputProof.sha256 -cne '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322' -or $taskF26Provenance.inputProof.fileCount -ne 989){throw 'Current21-driver provenance required.'}
 $taskF26Allowed=@()
 foreach($taskF26Driver in $taskF26Provenance.drivers){
  if($taskF26Driver.path -notmatch '^prebuilt-native-hosts-02/lite-[a-z0-9-]+-host[.]js$'){throw 'Unexpected current driver path.'}
  $taskF26File=Join-Path $PSScriptRoot $taskF26Driver.path
  if((Get-Item -LiteralPath $taskF26File).Length -ne $taskF26Driver.bytes -or (Get-FileHash -LiteralPath $taskF26File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Driver.sha256){throw 'Current built driver bytes changed.'}
  $taskF26Allowed+=[IO.Path]::GetFullPath($taskF26File)
 }
 foreach($taskF26Driver in @(
 @{path='retained-functional10-driver-01.js';bytes=532622;sha256='b64a85f99d9c5c3194b2bd427822116b7c59f8565dc3fc5477c27b92208a8b3b'},
 @{path='retained-security17-driver-01.js';bytes=13372;sha256='de3e734ece51d89adaa58caec792c5d39b142d9e88cd17b2cda312099d0d38c9'})){
  $taskF26File=Join-Path $PSScriptRoot $taskF26Driver.path
  if((Get-Item -LiteralPath $taskF26File).Length -ne $taskF26Driver.bytes -or (Get-FileHash -LiteralPath $taskF26File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Driver.sha256){throw 'Sealed retained functional/security driver changed.'}
  $taskF26Allowed+=[IO.Path]::GetFullPath($taskF26File)
 }
 $taskF26HostVariable=Get-Variable -Name HostTestsPath -ErrorAction SilentlyContinue
 if($taskF26HostVariable -and ([string]::IsNullOrWhiteSpace([string]$taskF26HostVariable.Value) -or $taskF26Allowed -inotcontains [IO.Path]::GetFullPath([string]$taskF26HostVariable.Value))){throw 'Only exact current21 or sealed functional/security drivers are admitted; no rebuild fallback.'}
 $taskF26Extension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 $taskF26ExtensionVariable=Get-Variable -Name ExtensionRoot -ErrorAction SilentlyContinue
 if($taskF26ExtensionVariable -and -not [string]::IsNullOrWhiteSpace([string]$taskF26ExtensionVariable.Value)){$taskF26Extension=[IO.Path]::GetFullPath([string]$taskF26ExtensionVariable.Value)}
 Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskF26Extension -ExpectedBundleSha256 $ExpectedBundleSha256
 if((Get-FileHash -LiteralPath (Join-Path $taskF26Extension 'dist/pre-commit-client.js') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449'){throw 'Exact new fourth worker bytes required.'}
 $taskF26Manifest=Get-Content -LiteralPath (Join-Path $taskF26Extension 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskF26Machines=@($taskF26Manifest.contributes.configuration.properties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'})
 if($taskF26Machines.Count -ne 82 -or $taskF26Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.default -ne $false -or $taskF26Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.scope -cne 'machine'){throw 'Current82 machine settings/default-off hook registration required.'}
 $taskF26Baseline=Join-Path $taskF26Repo 'docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json'
 if((Get-FileHash -LiteralPath $taskF26Baseline -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'c1cde060f5f062280b2e0961b49262569151ab716cf425b553363cb6f8646718'){throw 'Retained security baseline bytes changed.'}
}
function Get-F26ARuntimeBindings {
 param([Parameter(Mandatory=$true)][string]$ExecutionRoot)
 Assert-F26AAffectedInputs
 $taskF26Source=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 foreach($taskF26Name in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){
  $taskF26Original=Join-Path $taskF26Source ('dist/'+$taskF26Name);$taskF26Executed=Join-Path $ExecutionRoot ('dist/'+$taskF26Name)
  $taskF26Sha=(Get-FileHash -LiteralPath $taskF26Original -Algorithm SHA256).Hash.ToLowerInvariant();$taskF26Bytes=(Get-Item -LiteralPath $taskF26Original).Length
  if((Get-Item -LiteralPath $taskF26Executed).Length -ne $taskF26Bytes -or (Get-FileHash -LiteralPath $taskF26Executed -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Sha){throw 'Execution runtime differs from exact current VSIX extraction.'}
  @{name=$taskF26Name;bytes=$taskF26Bytes;sha256=$taskF26Sha;source=$taskF26Original;execution=$taskF26Executed}
 }
}
