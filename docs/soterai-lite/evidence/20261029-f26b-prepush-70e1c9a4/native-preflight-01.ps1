param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingSha256)
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskBindingFile=Join-Path $PSScriptRoot 'native-launch-binding-01.json'
if((Get-FileHash -LiteralPath $taskBindingFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedBindingSha256){throw 'Exact native binding differs.'}
$taskInitial=Get-Content -LiteralPath $taskBindingFile -Raw -Encoding UTF8|ConvertFrom-Json
$taskAdmission=Join-Path $PSScriptRoot $taskInitial.admission.path
if((Get-FileHash -LiteralPath $taskAdmission -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInitial.admission.sha256){throw 'Exact native admission differs.'}
. $taskAdmission
$taskBinding=Assert-F26BAdmission $taskBindingFile $ExpectedBindingSha256
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native-launch-consumption-01.json')){throw 'Native component attempt already consumed.'}
[ordered]@{status='PASS_CURRENT_NATIVE36_READONLY_ADMISSION_NOT_RUN';bindingSha256=$ExpectedBindingSha256;sourceProof=$taskBinding.sourceProof.sha256;vsixSha256=$taskBinding.vsix.sha256;nativeChecks=36;configuredGitPush='NOT_AUTHORIZED_NOT_RUN';f26aNative09='USER_DEFERRED_NOT_RUN';signalsRequested=0}|ConvertTo-Json -Depth 5
