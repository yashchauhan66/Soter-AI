$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskMaterialized=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-current-materialization-09.json') -Raw|ConvertFrom-Json
$taskBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-current-binding-09.json') -Raw|ConvertFrom-Json
$taskParsed=0
foreach($taskRow in $taskMaterialized.outputs){
 $taskTarget=Join-Path $taskRepo $taskRow.target.path
 if((Get-FileHash -LiteralPath $taskTarget -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.target.sha256 -or $taskRow.source.sha256 -cne $taskRow.target.sha256){throw 'Accepted affected helper copy differs'}
 if($taskTarget.EndsWith('.ps1')){
  $taskTokens=$null;$taskErrors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($taskTarget,[ref]$taskTokens,[ref]$taskErrors)
  if($taskErrors.Count){throw ('Affected helper parse failed: '+$taskTarget)}
  $taskParsed++
 }
}
$taskBindingFile=Join-Path $PSScriptRoot 'affected-native-binding-01.ps1'
$taskTokens=$null;$taskErrors=$null
[void][System.Management.Automation.Language.Parser]::ParseFile($taskBindingFile,[ref]$taskTokens,[ref]$taskErrors)
if($taskErrors.Count){throw 'Current binding parse failed'}
. $taskBindingFile
$VsixPath=Join-Path $taskRepo $taskBinding.vsix.path
$ExpectedVsixSha256=$taskBinding.vsix.sha256
$ExpectedBundleSha256=$taskBinding.frontendSha256
$ExtensionRoot=Join-Path $taskRepo $taskBinding.extractedRoot
$HostTestsPath=Join-Path $taskRepo $taskMaterialized.families[0].driver.path
Assert-F26AAffectedInputs
Write-Output 'PASS current exact artifact/source and accepted affected driver'
$HostTestsPath=Join-Path $PSScriptRoot 'prebuilt-native-hosts-09/lite-precommit-guard-host.js'
$taskRefused=$false
try{Assert-F26AAffectedInputs}catch{if($_.Exception.Message -notlike '*sealed affected driver required*'){throw};$taskRefused=$true}
if(-not $taskRefused){throw 'Separately authorized precommit driver was accepted through generic affected path'}
Write-Output 'PASS precommit driver excluded from generic affected route'
$HostTestsPath=Join-Path $taskRepo $taskMaterialized.families[0].driver.path
$ExpectedVsixSha256=('0'*64)
$taskRefused=$false
try{Assert-F26AAffectedInputs}catch{if($_.Exception.Message -notlike '*exact artifact parameters required*'){throw};$taskRefused=$true}
if(-not $taskRefused){throw 'Wrong artifact hash admitted'}
Write-Output 'PASS wrong artifact refused'
Write-Output ('PASS exact accepted helpers/parser/transitive closure: '+$taskMaterialized.outputs.Count+' copies, '+($taskParsed+1)+' PowerShell parses; no Code/profile launch')
