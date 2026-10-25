$ErrorActionPreference='Stop'
# Static docs-only validation. No generated template is dot-sourced or run.
$taskManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-template-inputs-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskManifest.status -cne 'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND' -or @($taskManifest.templates).Count -ne 29){throw 'Unexpected prepared manifest.'}
$taskRows=@();$taskErrors=@()
foreach($taskRow in $taskManifest.templates){
 $taskPath=Join-Path $PSScriptRoot $taskRow.template
 $taskBytes=[IO.File]::ReadAllBytes($taskPath)
 if($taskBytes.Length -ne $taskRow.bytes -or (Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskRow.sha256){throw ('Prepared template byte drift: '+$taskRow.template)}
 if($taskBytes -contains 0){throw ('Prepared template NUL: '+$taskRow.template)}
 $taskText=[Text.UTF8Encoding]::new($false,$true).GetString($taskBytes)
 if(-not $taskText.Contains('__F25_TEMPLATE_BOUND__') -or -not $taskText.Contains('PREPARED_NOT_BOUND')){throw ('Missing unbound failguard: '+$taskRow.template)}
 $taskActualTokens=@([regex]::Matches($taskText,'__F25_[A-Z0-9_]+__')|ForEach-Object{$_.Value}|Sort-Object -Unique)
 if((Compare-Object -ReferenceObject @($taskRow.placeholders) -DifferenceObject $taskActualTokens)){throw ('Prepared placeholder membership drift: '+$taskRow.template)}
 if($taskText -match 'Stop-Process|taskkill|(?:\.kill|\.Kill|process\.kill)\s*\(|TerminateProcess|WaitForExit\s*\(\s*-1\s*\)'){throw ('Signal/indefinite wait in prepared template: '+$taskRow.template)}
 if($taskRow.template.EndsWith('.ps1')){
  $taskTokens=$null;$taskParseErrors=$null
  [void][Management.Automation.Language.Parser]::ParseFile($taskPath,[ref]$taskTokens,[ref]$taskParseErrors)
  foreach($taskError in $taskParseErrors){$taskErrors+=@{path=$taskRow.template;message=$taskError.Message;line=$taskError.Extent.StartLineNumber}}
 }
 $taskRows+=@{path=$taskRow.template;bytes=$taskBytes.Length;sha256=$taskRow.sha256;unbound=$true;placeholders=$taskActualTokens}
}
if($taskErrors.Count){$taskErrors|ConvertTo-Json -Depth 8;throw 'Prepared PowerShell syntax validation failed.'}
$taskReport=@{status='PASS_STATIC_PREPARATION_ONLY_NOT_BOUND_NOT_EXECUTED';templateManifest='native-template-inputs-02.json';manifestSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'native-template-inputs-02.json') -Algorithm SHA256).Hash.ToLowerInvariant();templates=29;powershellParsed=28;powershellErrors=0;files=$taskRows;generatedCodeExecuted=$false;compilerBuildPackageEditorNative='NOT_RUN';scope='Current named template bytes, UTF8/NUL admission, exact placeholder membership, failguard presence, no-signals/finite-wait static markers and PowerShell parser only. CJS syntax has a separate static receipt.'}
$taskOut=Join-Path $PSScriptRoot 'native-preparation-ps-static-01.json'
$taskStream=[IO.File]::Open($taskOut,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskOutBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskReport|ConvertTo-Json -Depth 14)+[Environment]::NewLine);$taskStream.Write($taskOutBytes,0,$taskOutBytes.Length)}finally{$taskStream.Dispose()}
Write-Output 'PASS_STATIC_PREPARATION_ONLY:29current templates/28PowerShell parsed; all generated fixture execution NOT_RUN.'
