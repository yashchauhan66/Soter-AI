$ErrorActionPreference='Stop'
foreach($taskName in @('native09-candidate-02.ps1.txt','native09-preapproval-01.ps1','start-native09-chain-01.ps1','start-affected-current-09.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count){throw ('Packet parse failed: '+$taskName)}
}
& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot 'run-native09-chain-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Native09 Node syntax failed'}
& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot 'run-affected-current-09.cjs')
if($LASTEXITCODE -ne 0){throw 'Affected Node syntax failed'}
Write-Output 'PASS four actual PowerShell parses and two Node syntax checks; no native fixture launched'
