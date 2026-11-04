$ErrorActionPreference='Stop'
$taskSource=Join-Path $PSScriptRoot 'observe-marked-synthetic-code-proposed-01.ps1'
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile($taskSource,[ref]$taskTokens,[ref]$taskErrors)
if(@($taskErrors).Count -ne 0){throw 'Observation helper syntax invalid.'}
$taskFunctions=@($taskAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true))
if($taskFunctions.Count -ne 2){throw 'Exactly two inert parser functions required.'}
# Dot-source only the two parsed function definitions, never the query/IO body.
. ([scriptblock]::Create(($taskFunctions|ForEach-Object{$_.Extent.Text}) -join [Environment]::NewLine))
$script:taskForbiddenCalls=0
function Get-CimInstance {$script:taskForbiddenCalls++;throw 'No live CIM in parser controls.'}
function Get-NetTCPConnection {$script:taskForbiddenCalls++;throw 'No live listeners in parser controls.'}
$taskPrefix='D:\SoterAI-Lite-test-profiles\';$ExactProfile=''
$taskProfile='D:\SoterAI-Lite-test-profiles\f32-installed-20261104T015946Z-f3ae857e\profile-primary'
$taskRows=[Collections.Generic.List[object]]::new()
function Assert-MarkedParser([string]$Id,[bool]$Pass){$taskRows.Add([pscustomobject]@{id=$Id;pass=$Pass});if(-not $Pass){throw ('Pure marked parser failed: '+$Id)}}
function Test-MarkedParserReject([scriptblock]$Action){try{&$Action;return $false}catch{return $true}}
Assert-MarkedParser 'MP01-quoted-separated-exact-profile' ((Get-SoterAIMarkedProfile (Split-SoterAIMarkedWindowsArguments ('"C:\Fixture\Code.exe" --user-data-dir "'+$taskProfile+'"'))) -ceq $taskProfile)
Assert-MarkedParser 'MP02-equals-exact-profile' ((Get-SoterAIMarkedProfile (Split-SoterAIMarkedWindowsArguments ('Code.exe --user-data-dir='+$taskProfile))) -ceq $taskProfile)
Assert-MarkedParser 'MP03-normal-profile-not-counted' ($null -eq (Get-SoterAIMarkedProfile @('Code.exe','--user-data-dir=C:\Fixture\normal')))
Assert-MarkedParser 'MP04-sibling-prefix-not-counted' ($null -eq (Get-SoterAIMarkedProfile @('Code.exe','--user-data-dir=D:\SoterAI-Lite-test-profiles-other\normal')))
Assert-MarkedParser 'MP05-traversal-refused' (Test-MarkedParserReject {Get-SoterAIMarkedProfile @('Code.exe',('--user-data-dir='+$taskPrefix+'synthetic\..\normal'))})
Assert-MarkedParser 'MP06-duplicate-profile-refused' (Test-MarkedParserReject {Get-SoterAIMarkedProfile @('Code.exe',('--user-data-dir='+$taskProfile),'--user-data-dir',$taskProfile)})
Assert-MarkedParser 'MP07-unmatched-quote-refused' (Test-MarkedParserReject {Split-SoterAIMarkedWindowsArguments ('Code.exe --user-data-dir "'+$taskProfile)})
$ExactProfile=$taskProfile+'-other'
Assert-MarkedParser 'MP08-optional-exact-profile-filter' ($null -eq (Get-SoterAIMarkedProfile @('Code.exe',('--user-data-dir='+$taskProfile))))
Assert-MarkedParser 'MP09-no-live-query' ($script:taskForbiddenCalls -eq 0)
$taskValue=[ordered]@{schemaVersion=1;feature='V01';status='MARKED_CODE_PARSER_PURE_9_PASS_NOT_LIVE_ABSENCE';observedAt=[DateTime]::UtcNow.ToString('o');source=@{path=$taskSource;sha256=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $taskSource).Length};controls=$taskRows.ToArray();liveCimOrListenerCalls=$script:taskForbiddenCalls;codeLaunches=0;signalsRequested=0;scope='Extracted actual parser function bodies only; helper query and receipt body not invoked. No native absence coverage.'}
$taskOutput=Join-Path $PSScriptRoot 'marked-code-parser-controls-result-01.json'
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
Write-Output 'PASS: nine pure actual parser controls; zero live calls.'
Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
