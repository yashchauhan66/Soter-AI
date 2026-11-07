param([Parameter(Mandatory=$true)][string]$AdmissionPath,[Parameter(Mandatory=$true)][string]$AdmissionSha256)
$ErrorActionPreference='Stop'
$taskCurrentOwner=Join-Path $PSScriptRoot 'codexcli-route-current-02.cjs'
$taskAdmissionOutput = & 'C:\Program Files\nodejs\node.exe' $taskCurrentOwner --validate-prepared $AdmissionPath $AdmissionSha256
Write-Output ('INITIAL_NODE_EXIT='+[string]$LASTEXITCODE)
if($LASTEXITCODE -ne 0){throw 'Current final route admission refused'}
Write-Output ('ADMISSION_OUTPUT_IS_EXACT_PASS='+[string](($taskAdmissionOutput -join [Environment]::NewLine).Trim() -ceq 'PASS_READ_ONLY_ADMISSION_NATIVE_NOT_RUN'))
