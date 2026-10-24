$ErrorActionPreference='Stop'
$taskInputs=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'host-fixture-inputs-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskRows=@()
foreach($taskRecord in $taskInputs.records){
 $taskFile=Join-Path $PSScriptRoot $taskRecord.path
 if((Get-Item -LiteralPath $taskFile).Length -ne $taskRecord.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRecord.sha256){throw 'Prepared helper bytes changed.'}
 if([IO.Path]::GetExtension($taskFile) -ceq '.ps1'){
  $taskTokens=$null;$taskErrors=$null
  [void][Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
  if(@($taskErrors).Count -ne 0){throw ('Prepared fixture syntax failed: '+$taskRecord.path)}
  $taskText=[IO.File]::ReadAllText($taskFile)
  if($taskText -match '\bStop-Process\b|\btaskkill\b|\.Kill\s*\('){throw 'Signal operation refused.'}
  $taskRows+=@{path=$taskRecord.path;sha256=$taskRecord.sha256;parseErrors=0;signalsRequested=0}
 }
}
if($taskRows.Count -ne 20){throw 'Expected20preparedPSfixtures.'}
@{status='PASS_STATIC_PREPARED_FIXTURES_ONLY';scripts=$taskRows;nativeBehaviorVerified=$false;signalsRequested=0}|ConvertTo-Json -Depth 8|Out-File -LiteralPath (Join-Path $PSScriptRoot 'prepared-syntax-01.json') -Encoding utf8 -NoClobber
@{status='PASS_STATIC_PREPARED_FIXTURES_ONLY';scripts=$taskRows.Count;nativeBehaviorVerified=$false}|ConvertTo-Json
