$ErrorActionPreference='Stop'
$taskRows=@()
foreach($taskFile in Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter '*.ps1'){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile($taskFile.FullName,[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count -ne 0){throw ('Helper syntax invalid: '+$taskFile.Name)}
 $taskText=[IO.File]::ReadAllText($taskFile.FullName)
 if($taskText -match '\bStop-Process\b|\btaskkill\b|\.Kill\s*\('){throw ('Signal operation refused: '+$taskFile.Name)}
 $taskRows+=@{path=$taskFile.Name;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant();parseErrors=0;signalOperations=0}
}
$taskReport=@{status='PASS_HELPER_SYNTAX_AND_NO_SIGNALS_ONLY';records=$taskRows;nativeBehaviorVerified=$false;scope='Current local PS helpers, including docs-only rerun wrappers and both byte stages; no host launched by this validator.'}
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
$taskHandle=[IO.File]::Open((Join-Path $PSScriptRoot 'current-helper-validation-08.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskHandle.Write($taskBytes,0,$taskBytes.Length)}finally{$taskHandle.Dispose()}
@{status=$taskReport.status;helpers=$taskRows.Count;launchedHosts=0}|ConvertTo-Json
