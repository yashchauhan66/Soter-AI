$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskMaterialization=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-current-materialization-09.json') -Raw -Encoding utf8|ConvertFrom-Json
$taskNames=@($taskMaterialization.outputs|ForEach-Object{$_.target.path})+@('docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/affected-native-binding-07.ps1')
foreach($taskName in $taskNames){$taskFile=Join-Path $taskRepo $taskName;$taskTokens=$null;$taskErrors=$null;[void][Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors);if($taskErrors.Count){throw ('Affected PowerShell syntax failed: '+$taskName)}}
[ordered]@{status='PASS_AFFECTED23_HELPERS_PLUS_SHARED_BINDING_SYNTAX_ONLY_NOT_NATIVE';files=$taskNames.Count;changedOriginalAssertions=0;configuredPush='NOT_AUTHORIZED_NOT_RUN';f26aNative09='USER_DEFERRED_NOT_RUN';signalsRequested=0}|ConvertTo-Json
