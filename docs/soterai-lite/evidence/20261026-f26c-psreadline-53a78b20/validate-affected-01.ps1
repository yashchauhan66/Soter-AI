$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-binding-04.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$VsixPath=Join-Path $taskRepo $taskBinding.vsix.path
$ExpectedVsixSha256=$taskBinding.vsix.sha256
$ExpectedBundleSha256=$taskBinding.frontendSha256
$ExtensionRoot=Join-Path $taskRepo $taskBinding.extractedRoot
$HostTestsPath=Join-Path $PSScriptRoot 'prebuilt-native-hosts-03/lite-logs-host.js'
$CodePath='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
. (Join-Path $PSScriptRoot 'affected-native-binding-01.ps1')
$taskMaterialized=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-materialization-01.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskParsed=0
foreach($taskInput in $taskMaterialized.outputs){
 $taskFile=Join-Path $taskRepo $taskInput.path
 if((Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Materialized helper changed.'}
 $taskTokens=$null;$taskErrors=$null;$null=[Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count){throw 'Materialized helper syntax failure.'};$taskParsed++
}
if($taskParsed -ne 26){throw 'Exact26 materialized helpers required.'}
Assert-F26AAffectedInputs
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $ExtensionRoot -ExpectedBundleSha256 $ExpectedBundleSha256
$taskGoodHash=$ExpectedVsixSha256;$ExpectedVsixSha256=('0'*64);$taskRefused=$false
try{Assert-F26AAffectedInputs}catch{$taskRefused=$true}finally{$ExpectedVsixSha256=$taskGoodHash}
if(-not $taskRefused){throw 'Wrong artifact hash not refused.'}
$taskGoodHost=$HostTestsPath;$HostTestsPath=Join-Path $PSScriptRoot 'prebuilt-native-hosts-03/lite-precommit-guard-host.js';$taskRefused=$false
try{Assert-F26AAffectedInputs}catch{$taskRefused=$true}finally{$HostTestsPath=$taskGoodHost}
if(-not $taskRefused){throw 'Unapproved precommit driver not refused.'}
$taskGoodCode=$CodePath;$CodePath='C:\Windows\System32\not-Code.exe';$taskRefused=$false
try{Assert-F26AEditorHost}catch{$taskRefused=$true}finally{$CodePath=$taskGoodCode}
if(-not $taskRefused){throw 'Wrong editor path not refused.'}
@{status='PASS_STATIC_PARSE_AND_NEGATIVE_ADMISSION_ONLY';helpers=26;positiveExactBinding=$true;wrongArtifactRefused=$true;precommitNative06Refused=$true;wrongEditorRefused=$true;nativeLaunched=0;signalsRequested=0} | ConvertTo-Json -Depth 5 | Out-File -LiteralPath (Join-Path $PSScriptRoot 'affected-validation-01.json') -Encoding utf8 -NoClobber
Write-Output 'PASS26 syntax/exact current binding and three negative admission checks; no native launch.'
