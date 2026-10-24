$ErrorActionPreference='Stop'
$taskRows=@()
foreach($taskFile in @(Get-ChildItem -LiteralPath $PSScriptRoot -Recurse -File -Filter '*.ps1')){
 $taskTokens=$null;$taskErrors=$null
 $taskAst=[Management.Automation.Language.Parser]::ParseFile($taskFile.FullName,[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ('Prepared PowerShell syntax refused: '+$taskFile.Name)}
 $taskForbidden=$taskAst.FindAll({param($node)
  ($node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -match '^(?:Stop-Process|taskkill|kill|Stop-Computer|Restart-Computer)$') -or
  ($node -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $node.Member.Value -match '^(?:Kill|Terminate|CloseMainWindow)$')
 },$true)
 if($taskForbidden.Count -ne 0){throw ('Prepared signal/termination command refused: '+$taskFile.Name)}
 $taskRows+=@{path=$taskFile.FullName;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskNode=0
foreach($taskFile in @(Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter '*.cjs')){
 & node --check $taskFile.FullName
 if($LASTEXITCODE -ne 0){throw ('Prepared JavaScript syntax refused: '+$taskFile.Name)}
 $taskNode++
}
& node (Join-Path $PSScriptRoot 'check-inputs-02.cjs')
if($LASTEXITCODE -ne 0){throw 'Current scoped frozen input drift.'}
$taskValue=@{status='PASS_PREPARED_SYNTAX_NO_SIGNALS_NOT_NATIVE_EXECUTION';powershell=$taskRows;nodeScripts=$taskNode;scope='Syntax and forbidden-operation AST checks only. Unbound templates are never executed; actual feature/native/package/withdrawal/committed-byte gates remain separate.'}
$taskOut=Join-Path $PSScriptRoot 'prepared-validation-04.json'
$taskStream=[IO.File]::Open($taskOut,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 8)+[Environment]::NewLine);$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
@{status=$taskValue.status;psScripts=$taskRows.Count;nodeScripts=$taskNode}|ConvertTo-Json
