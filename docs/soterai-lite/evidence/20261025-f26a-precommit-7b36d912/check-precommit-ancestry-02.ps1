$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskTargets=@((Join-Path $PSScriptRoot 'vsix-extracted-01/extension'),(Join-Path $PSScriptRoot 'prebuilt-native-hosts-02/lite-precommit-guard-host.js'),(Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix'))
$taskResults=@()
foreach($taskVersion in @('01','02')){
 $taskFile=Join-Path $PSScriptRoot ('run-precommit-native-'+$taskVersion+'.ps1');$taskTokens=$null;$taskErrors=$null
 $taskAst=[Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count -ne 0){throw 'Launcher syntax failure.'}
 $taskFunction=@($taskAst.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Assert-F26AOrdinary'},$true))
 if($taskFunction.Count -ne 1){throw 'Exact fixture ancestry guard required.'}
 Invoke-Expression $taskFunction[0].Extent.Text
 $taskRows=@()
 foreach($taskTarget in $taskTargets){$taskPassed=$false;$taskError=$null;try{Assert-F26AOrdinary $taskTarget;$taskPassed=$true}catch{$taskError=$_.Exception.Message};$taskRows+=@{target=$taskTarget;accepted=$taskPassed;error=$taskError}}
 if($taskVersion -ceq '01' -and @($taskRows|Where-Object{$_.accepted}).Count -ne 0){throw 'Original refusal not reproduced.'}
 if($taskVersion -ceq '02' -and @($taskRows|Where-Object{-not $_.accepted}).Count -ne 0){throw 'Scoped successor still refuses ordinary in-workspace inputs.'}
 $taskOutsideRefused=$false;try{Assert-F26AOrdinary 'C:\Users\USER'}catch{$taskOutsideRefused=$true}
 if($taskVersion -ceq '02' -and -not $taskOutsideRefused){throw 'Outside workspace was not refused.'}
 $taskResults+=@{version=$taskVersion;rows=$taskRows;outsideWorkspaceRefused=$taskOutsideRefused;launcherSha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
@{status='PASS_ORIGINAL_REFUSAL_AND_SCOPED_SUCCESSOR_NO_CODE_LAUNCH';time=[DateTime]::UtcNow.ToString('o');results=$taskResults;scope='Guard-only AST extraction, no launcher body/Code/Git/D-profile mutation.'}|ConvertTo-Json -Depth 10|Out-File -LiteralPath (Join-Path $PSScriptRoot 'precommit-ancestry-guard-check-02.json') -NoClobber -Encoding utf8
Write-Output 'Guard-only original3refusals reproduced; successor3ordinaryinputs accepted/outsideworkspace refused. No Code/Git launch.'
