param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
$ErrorActionPreference='Stop'
if('F24_CURRENT_FACTS_BOUND' -cne 'F24_CURRENT_FACTS_BOUND'){throw 'F24 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
. (Join-Path $PSScriptRoot 'host-current-binding-02.ps1')
Assert-F24EditorHost
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskExtension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
. (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
$taskArtifactOutput=Join-Path $PSScriptRoot 'artifact-native-run-02.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-artifact-native-02.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-artifact-host.js'),'-ExtensionRoot',$taskExtension,'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskArtifactOutput -WorkingDirectory $taskRepo
$taskArtifactReceipt=Get-Content -LiteralPath ($taskArtifactOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskArtifactReceipt.exitCode -ne 0){throw 'Artifact native gate failed/incomplete; affected suite was not started.'}
Assert-F24EditorHost
$taskAffectedOutput=Join-Path $PSScriptRoot 'current-affected-suite-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-02.ps1'),'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskAffectedOutput -WorkingDirectory $taskRepo
$taskAffectedReceipt=Get-Content -LiteralPath ($taskAffectedOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskAffectedReceipt.exitCode -ne 0){throw 'Current affected suite failed/incomplete; retain all attempts.'}
Assert-F24EditorHost
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
Write-Output 'F24 artifact25 and current affected history25/MCP+9/retained106/functional10/security17 completed their actual gated launch paths; acceptance and byte proofs remain separate.'
