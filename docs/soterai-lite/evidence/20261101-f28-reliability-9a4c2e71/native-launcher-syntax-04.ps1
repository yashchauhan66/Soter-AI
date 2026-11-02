$ErrorActionPreference='Stop'
$taskTokens=$null;$taskErrors=$null
foreach($taskName in @('native-admission-02.ps1.txt','native-launch-candidate-03.ps1.txt')){
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count -ne 0){$taskErrors|ForEach-Object{$_.Message};throw 'Prepared PowerShell syntax refused.'}
}
$taskText=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'native-launch-candidate-03.ps1.txt'))
$taskBootstrap=[regex]::Match($taskText,"(?s)\x24taskBootstrap=@'\r?\n(.*?)\r?\n'@").Groups[1].Value
if(-not $taskBootstrap){throw 'Bootstrap extraction incomplete.'}
$taskBootstrapFile=Join-Path $PSScriptRoot 'native-bootstrap-04.cjs'
if(Test-Path -LiteralPath $taskBootstrapFile){throw 'Evidence overwrite refused.'}
[IO.File]::WriteAllText($taskBootstrapFile,$taskBootstrap,[Text.UTF8Encoding]::new($false))
& 'C:\Program Files\nodejs\node.exe' --check $taskBootstrapFile
if($LASTEXITCODE -ne 0){throw 'Prepared native bootstrap syntax refused.'}
Write-Output 'PASS: PowerShell2 and actual extracted Node bootstrap1 syntax. Node check used .cjs, not unsupported .txt. No Code launch.'
