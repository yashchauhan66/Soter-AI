# Runs only pure argument/path/regex controls. Live observation commands are
# replaced with forbidden callbacks so no live process/listener call can run.
$ErrorActionPreference='Stop'
$script:taskForbiddenCim=0;$script:taskForbiddenListener=0
function Get-CimInstance {$script:taskForbiddenCim++;throw 'Forbidden live CIM in pure controls.'}
function Get-NetTCPConnection {$script:taskForbiddenListener++;throw 'Forbidden live listener query in pure controls.'}
$taskControls=Join-Path $PSScriptRoot 'owner-custody-pure-controls-01.ps1'
$taskBefore=Join-Path $PSScriptRoot 'installed-owner-custody-proposed-02.ps1'
$taskAfter=Join-Path $PSScriptRoot 'installed-owner-custody-proposed-04.ps1'
$taskOriginalFailure=$null
try{[void](& $taskControls -SourcePath $taskBefore)}catch{$taskOriginalFailure=$_.Exception.Message}
if($taskOriginalFailure -cne 'Pure custody control failed: P02-root-positive-2'){throw 'Expected original inert initial-root regex failure was not reproduced.'}
$taskAfterRaw=& $taskControls -SourcePath $taskAfter
$taskAfterResult=ConvertFrom-Json -InputObject $taskAfterRaw -ErrorAction Stop
if($taskAfterResult.status -cne 'PURE_CUSTODY_CONTROLS_PASS_NOT_NATIVE' -or @($taskAfterResult.controls).Count -ne 16 -or @($taskAfterResult.controls|Where-Object{-not $_.pass}).Count -ne 0){throw 'Corrected pure controls incomplete.'}
if($script:taskForbiddenCim -ne 0 -or $script:taskForbiddenListener -ne 0){throw 'Pure controls attempted a live observation.'}
function Get-F32PureSourceFact([string]$LiteralPath){$taskItem=Get-Item -LiteralPath $LiteralPath;return @{path=$LiteralPath;bytes=$taskItem.Length;sha256=(Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant()}}
$taskRecord=[ordered]@{schemaVersion=1;feature='F32';status='PURE_CUSTODY_16_PASS_ORIGINAL_REGEX_FAILURE_REPRODUCED_NOT_NATIVE';observedAt=[DateTime]::UtcNow.ToString('o');originalSource=(Get-F32PureSourceFact $taskBefore);originalFailure=$taskOriginalFailure;currentSource=(Get-F32PureSourceFact $taskAfter);controlSource=(Get-F32PureSourceFact $taskControls);currentResult=$taskAfterResult;forbiddenCimCalls=$script:taskForbiddenCim;forbiddenListenerCalls=$script:taskForbiddenListener;codeLaunches=0;helperTokenObservations=0;scope='Pure source parser, regex, path and Windows argv controls only. No native owner, listener, process token, host, install, network or physical EOF check.'}
$taskOutput=Join-Path $PSScriptRoot 'owner-custody-pure-controls-result-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskRecord|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Write-Output ('PASS: pure16; original regex failure reproduced; live queries0; receipt '+$taskOutput)
