param([Parameter(Mandatory=$true)][string]$AdmissionPath,[Parameter(Mandatory=$true)][string]$AdmissionSha256)
$ErrorActionPreference='Stop'
$taskCurrentOwner=Join-Path $PSScriptRoot 'codexcli-route-current-02.cjs'
& 'C:\Program Files\nodejs\node.exe' $taskCurrentOwner --validate-prepared $AdmissionPath $AdmissionSha256
Write-Output ('INITIAL_NODE_EXIT='+[string]$LASTEXITCODE)
if($LASTEXITCODE -ne 0){throw 'Current final route admission refused'}
