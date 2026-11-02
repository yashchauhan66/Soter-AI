$ErrorActionPreference='Stop'
# Syntax/AST inspection only. Never invoke or dot-source any prepared helper.
$taskHelperRows=@()
foreach($taskHelperName in @('native09-host-current-binding-01.ps1','native09-artifact-binding-01.ps1')){
 $taskHelperFile=Join-Path $PSScriptRoot $taskHelperName
 $taskHelperTokens=$null;$taskHelperErrors=$null
 $taskHelperAst=[System.Management.Automation.Language.Parser]::ParseFile($taskHelperFile,[ref]$taskHelperTokens,[ref]$taskHelperErrors)
 if(@($taskHelperErrors).Count -ne 0){throw ('Helper syntax errors: '+$taskHelperName)}
 foreach($taskHelperStatement in @($taskHelperAst.EndBlock.Statements)){if($taskHelperStatement -isnot [System.Management.Automation.Language.FunctionDefinitionAst]){throw 'Helpers must define functions only at top level.'}}
 $taskHelperCommands=@($taskHelperAst.FindAll({param($taskNode)$taskNode -is [System.Management.Automation.Language.CommandAst]},$true)|ForEach-Object{$_.GetCommandName()})
 if(@($taskHelperCommands|Where-Object{$_ -match '(?i)(^|[\/])(Code|git)[.]exe$|^(Start-Process|Stop-Process|Invoke-Expression|taskkill)$'}).Count -ne 0){throw 'Native/process action must not appear in metadata helpers.'}
 $taskHelperRows+=@{path=$taskHelperName;bytes=(Get-Item -LiteralPath $taskHelperFile).Length;sha256=(Get-FileHash -LiteralPath $taskHelperFile -Algorithm SHA256).Hash.ToLowerInvariant();parserErrors=0;topLevelFunctions=@($taskHelperAst.EndBlock.Statements).Count;commandNames=$taskHelperCommands}
}
$taskHelperResult=[ordered]@{status='STATIC_CURRENT_HELPER_PARSE_ONLY_NOT_ADMISSION_OR_NATIVE_COVERAGE';observedAt=[DateTime]::UtcNow.ToString('o');helpers=$taskHelperRows;helpersInvoked=0;nativeLaunches=0;gitOperations=0;signalsRequested=0;native09='EXPLICIT_USER_DEFERRED_NOT_RUN'}
$taskHelperOutput=Join-Path $PSScriptRoot 'current-helper-powershell-parse-01.json'
$taskHelperFd=[IO.File]::Open($taskHelperOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHelperBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskHelperResult|ConvertTo-Json -Depth 14)+[Environment]::NewLine);$taskHelperFd.Write($taskHelperBytes,0,$taskHelperBytes.Length);$taskHelperFd.Flush($true)}finally{$taskHelperFd.Dispose()}
[ordered]@{status=$taskHelperResult.status;parsedHelpers=$taskHelperRows.Count;parserErrors=0;helpersInvoked=0;nativeLaunches=0}|ConvertTo-Json -Compress
