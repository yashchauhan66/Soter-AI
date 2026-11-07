$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$CodePath='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$VsixPath=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt02.vsix'
$ExpectedVsixSha256='032e88e332df9a9470dcfc83ddcdfd60b722991fdae0be4a61d701604ef46629'
$ExpectedBundleSha256='99af67297678d240ae03e4aaab71c47f81b3e4f7aa645d8f9f28ac601e549942'
$ExtensionRoot=Join-Path $PSScriptRoot 'vsix-extracted-02/extension'
$HostTestsPath=Join-Path $PSScriptRoot 'prebuilt-native-hosts-04/lite-precommit-guard-host.js'
. (Join-Path $PSScriptRoot 'host-current-binding-03.ps1')
. (Join-Path $PSScriptRoot 'artifact-binding-02.ps1')
. (Join-Path $PSScriptRoot 'affected-native-binding-04.ps1')
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $ExtensionRoot -ExpectedBundleSha256 $ExpectedBundleSha256
Assert-F26AAffectedInputs
$taskMaterialization=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-native-materialization-04.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskParses=@()
foreach($taskOutput in $taskMaterialization.outputs){
 $taskFile=Join-Path $taskRepo $taskOutput.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskOutput.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskOutput.sha256){throw 'Materialized helper bytes changed.'}
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskErrors|Out-String)}
 $taskParses+=@{path=$taskOutput.path;sha256=$taskOutput.sha256;bytes=$taskOutput.bytes;errorCount=0}
}
@{status='CURRENT990_FULL03_COMPILER15_BUILD04_ATTEMPT02_HOST_AND_AFFECTED_BINDINGS_PASS_NOT_NATIVE';observedAt=[DateTime]::UtcNow.ToString('o');vsixSha256=$ExpectedVsixSha256;frontendSha256=$ExpectedBundleSha256;fileCount=990;boundPowerShellSyntax=$taskParses;native06Authorized=$false;nativeExecution='NOT_RUN';signalsRequested=0}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'current04-binding-validation-01.json') -Encoding utf8 -NoClobber
Write-Output 'Fresh current990/full03/compiler15/build04/attempt02/Code/artifact/26affected-helper bindings checked; native06 NOT_RUN.'
