param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingSha256)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'));$taskBindingFile=Join-Path $PSScriptRoot 'configured-push-binding-03.json'
if((Get-FileHash -LiteralPath $taskBindingFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedBindingSha256){throw 'Exact configured-push binding required.'}
$taskInitial=Get-Content -LiteralPath $taskBindingFile -Raw -Encoding utf8|ConvertFrom-Json;$taskAdmission=Join-Path $PSScriptRoot $taskInitial.admission.path
if((Get-FileHash -LiteralPath $taskAdmission -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInitial.admission.sha256){throw 'Exact configured-push admission helper required.'}
. $taskAdmission
$taskBinding=Assert-F26BAdmission $taskBindingFile $ExpectedBindingSha256
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'configured-push-consumption-03.json')){throw 'Configured-push attempt already consumed.'}
[ordered]@{status='PASS_CURRENT_CONFIGURED_PUSH8_READONLY_ADMISSION_NOT_AUTHORIZATION_OR_NATIVE';bindingSha256=$ExpectedBindingSha256;sourceProof=$taskBinding.sourceProof.sha256;vsixSha256=$taskBinding.vsix.sha256;nativeChecks=8;plannedLocalFilePushInvocations=2;configuredGitPush='NOT_AUTHORIZED_NOT_RUN';externalNetwork=$false;f26aNative09='USER_DEFERRED_NOT_RUN';signalsRequested=0}|ConvertTo-Json
