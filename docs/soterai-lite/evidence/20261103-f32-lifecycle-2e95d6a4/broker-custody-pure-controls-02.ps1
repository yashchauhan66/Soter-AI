# Pure source/path/argv/binding-copy checks, no live ownership/network calls.
$ErrorActionPreference='Stop'
$script:taskForbiddenCim=0;$script:taskForbiddenListener=0
function Get-CimInstance {$script:taskForbiddenCim++;throw 'Forbidden live CIM in pure broker controls.'}
function Get-NetTCPConnection {$script:taskForbiddenListener++;throw 'Forbidden live listener query in pure broker controls.'}
$taskOwnerSource=Join-Path $PSScriptRoot 'installed-owner-custody-proposed-04.ps1'
$taskBrokerSource=Join-Path $PSScriptRoot 'installed-broker-custody-proposed-02.ps1'
foreach($taskSource in @($taskOwnerSource,$taskBrokerSource)){
    $taskErrors=$null;$taskTokens=$null
    [void][Management.Automation.Language.Parser]::ParseFile($taskSource,[ref]$taskTokens,[ref]$taskErrors)
    if(@($taskErrors).Count -ne 0){throw 'F32 broker custody source syntax errors.'}
}
. $taskOwnerSource
. $taskBrokerSource
$taskResults=[Collections.Generic.List[object]]::new()
function Assert-F32BrokerPure([string]$Name,[bool]$Condition){$taskResults.Add([pscustomobject]@{id=$Name;pass=$Condition});if(-not $Condition){throw ('Pure broker control failed: '+$Name)}}
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskRoot='D:\SoterAI-Lite-test-profiles\f32-installed-20261103T160000Z-a1b2c3d4'
$taskScript=$taskRoot+'\Extensions\soterai.soterai-ide-guard-0.7.0-win32-x64\dist\local-ai-broker.js'
Assert-F32BrokerPure 'B01-exact-current-script' (Test-F32ExactBrokerArguments -Arguments @($taskCode,$taskScript) -CodeExecutable $taskCode -ScriptPath $taskScript)
Assert-F32BrokerPure 'B02-one-script-is-required' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode) -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B03-extra-argv-refused' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,$taskScript,'--port=12345') -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B04-flag-form-is-not-script' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,('--script='+$taskScript)) -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B05-other-executable-refused' (-not (Test-F32ExactBrokerArguments -Arguments @('C:\Program Files\nodejs\node.exe',$taskScript) -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B06-other-profile-script-refused' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,$taskScript.Replace('a1b2c3d4','f1f2f3f4')) -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B07-parent-traversal-refused' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,$taskScript.Replace('\dist\','\dist\..\dist\')) -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B08-UNC-script-refused' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,'\\server\share\local-ai-broker.js') -CodeExecutable $taskCode -ScriptPath $taskScript))
Assert-F32BrokerPure 'B09-Windows-path-case-accepted' (Test-F32ExactBrokerArguments -Arguments @($taskCode.ToUpperInvariant(),$taskScript.ToUpperInvariant()) -CodeExecutable $taskCode -ScriptPath $taskScript)
Assert-F32BrokerPure 'B10-public-profile-flag-not-script' (-not (Test-F32ExactBrokerArguments -Arguments @($taskCode,'--user-data-dir=C:\normal-profile') -CodeExecutable $taskCode -ScriptPath $taskScript))
$taskObject=[pscustomobject]@{phase='restart';brokerNonce=('a'*32);expectedBrokerScript=[pscustomobject]@{path=$taskScript;bytes=100;sha256=('a'*64)}}
$taskCopy=Copy-F32BrokerBinding $taskObject
Assert-F32BrokerPure 'B11-JSON-object-copy-retains-real-keys' ($taskCopy.Count -eq 3 -and $taskCopy['phase'] -ceq 'restart' -and $taskCopy['expectedBrokerScript'].path -ceq $taskScript)
$taskSecondCopy=Copy-F32BrokerBinding $taskCopy
Assert-F32BrokerPure 'B12-ordered-derived-copy-retains-real-keys' ($taskSecondCopy.Count -eq 3 -and $taskSecondCopy['phase'] -ceq 'restart' -and $taskSecondCopy['expectedBrokerScript'].path -ceq $taskScript)
$taskSecondCopy['brokerNonce']='b'*32
Assert-F32BrokerPure 'B13-derived-top-level-copy-does-not-rewrite-parent' ($taskCopy['brokerNonce'] -ceq ('a'*32) -and $taskObject.brokerNonce -ceq ('a'*32))
$taskParsed=Split-F32WindowsArguments ('"'+$taskCode+'" "'+$taskScript+'"')
Assert-F32BrokerPure 'B14-quoted-owned-spawn-argv' (Test-F32ExactBrokerArguments -Arguments $taskParsed -CodeExecutable $taskCode -ScriptPath $taskScript)
if($script:taskForbiddenCim -ne 0 -or $script:taskForbiddenListener -ne 0){throw 'Pure broker controls attempted live observation.'}
function Get-F32BrokerPureFact([string]$LiteralPath){$taskItem=Get-Item -LiteralPath $LiteralPath;return @{path=$LiteralPath;bytes=$taskItem.Length;sha256=(Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant()}}
$taskRecord=[ordered]@{schemaVersion=1;feature='F32';status='BROKER_CUSTODY_14_PURE_CONTROLS_PASS_NOT_NATIVE';observedAt=[DateTime]::UtcNow.ToString('o');ownerLibrary=(Get-F32BrokerPureFact $taskOwnerSource);brokerLibrary=(Get-F32BrokerPureFact $taskBrokerSource);controls=$taskResults.ToArray();forbiddenCimCalls=$script:taskForbiddenCim;forbiddenListenerCalls=$script:taskForbiddenListener;codeLaunches=0;networkRequests=0;signalsRequested=0;scope='Pure exact argv/path and immutable binding-copy controls. No actual broker, process tree, listener, heartbeat, protocol watcher, token, install or pipe EOF observed.'}
$taskOutput=Join-Path $PSScriptRoot 'broker-custody-pure-controls-result-02.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskRecord|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Write-Output ('PASS: broker pure14, live queries0; receipt '+$taskOutput)
