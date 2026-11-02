$ErrorActionPreference='Stop'
# Parse inert text only. Do not dot-source, invoke or materialize the launcher.
$taskNativeText=Join-Path $PSScriptRoot 'native09-launcher-UNBOUND-01.ps1.txt'
$taskNativeTokens=$null
$taskNativeErrors=$null
$taskNativeAst=[System.Management.Automation.Language.Parser]::ParseFile($taskNativeText,[ref]$taskNativeTokens,[ref]$taskNativeErrors)
if(@($taskNativeErrors).Count -ne 0){throw ('Inert PowerShell parse failed: '+(@($taskNativeErrors)|ForEach-Object{$_.Message}|ConvertTo-Json -Compress))}
if($taskNativeAst.ParamBlock.Parameters.Count -ne 6){throw 'Original six parameter contract differs.'}
$taskNativeFirst=@($taskNativeAst.EndBlock.Statements)[0]
if($taskNativeFirst -isnot [System.Management.Automation.Language.ThrowStatementAst] -or -not $taskNativeFirst.Extent.Text.Contains('UNBOUND_NOT_EXECUTABLE_F26A_NATIVE09')){throw 'Inert launcher must unconditionally refuse before any body action.'}
$taskNativeResult=[ordered]@{
 status='STATIC_POWERSHELL_TEXT_PARSE_AND_FIRST_THROW_ONLY_NOT_NATIVE_COVERAGE'
 observedAt=[DateTime]::UtcNow.ToString('o')
 file='native09-launcher-UNBOUND-01.ps1.txt'
 bytes=(Get-Item -LiteralPath $taskNativeText).Length
 sha256=(Get-FileHash -LiteralPath $taskNativeText -Algorithm SHA256).Hash.ToLowerInvariant()
 originalParameters=6
 parserErrors=0
 firstBodyStatement='UNCONDITIONAL_UNBOUND_THROW'
 nativeLaunches=0
 builds=0
 typechecks=0
 signalsRequested=0
 native09='EXPLICIT_USER_DEFERRED_NOT_RUN'
}
$taskNativeOutput=Join-Path $PSScriptRoot 'inert-powershell-syntax-01.json'
$taskNativeFd=[IO.File]::Open($taskNativeOutput,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskNativeRaw=[Text.UTF8Encoding]::new($false).GetBytes(($taskNativeResult|ConvertTo-Json -Depth 8)+[Environment]::NewLine);$taskNativeFd.Write($taskNativeRaw,0,$taskNativeRaw.Length);$taskNativeFd.Flush($true)}finally{$taskNativeFd.Dispose()}
$taskNativeResult|ConvertTo-Json -Compress
