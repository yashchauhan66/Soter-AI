param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
$ErrorActionPreference='Stop'
if('__F25_TEMPLATE_BOUND__' -cne 'F25_CURRENT_FACTS_BOUND'){throw 'F25 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F25EditorHost
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskExtension=Join-Path $PSScriptRoot '__F25_EXTRACTED_EXTENSION_RELATIVE__'
. (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
Assert-F25EditorHost
$taskCurrentOutput=Join-Path $PSScriptRoot 'logs-native-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-logs-native-01.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot '__F25_NATIVE_HOST_OUTPUT_DIR__/lite-logs-host.js'),'-ExtensionRoot',$taskExtension,'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskCurrentOutput -WorkingDirectory $taskRepo
$taskCurrentReceipt=Get-Content -LiteralPath ($taskCurrentOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskCurrentReceipt.exitCode -ne 0){throw 'logs native failed/incomplete; later affected gates NOT_RUN.'}
Assert-F25EditorHost
$taskCurrentOutput=Join-Path $PSScriptRoot 'owned-output-native-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-owned-output-native-01.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot '__F25_NATIVE_HOST_OUTPUT_DIR__/lite-log-vault-runtime-host.js'),'-ExtensionRoot',$taskExtension,'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskCurrentOutput -WorkingDirectory $taskRepo
$taskCurrentReceipt=Get-Content -LiteralPath ($taskCurrentOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskCurrentReceipt.exitCode -ne 0){throw 'owned-output native failed/incomplete; later affected gates NOT_RUN.'}
$taskAffectedOutput=Join-Path $PSScriptRoot 'current-affected-suite-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-01.ps1'),'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskAffectedOutput -WorkingDirectory $taskRepo
$taskAffectedReceipt=Get-Content -LiteralPath ($taskAffectedOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskAffectedReceipt.exitCode -ne 0){throw 'Current affected suite failed/incomplete; retain all attempts.'}
Assert-F25EditorHost
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
Write-Output 'F25 savedlogs25/ownedoutput19 and all20 current native families/functional10/security17 completed their actual gated launch paths; acceptance and byte proofs remain separate.'
