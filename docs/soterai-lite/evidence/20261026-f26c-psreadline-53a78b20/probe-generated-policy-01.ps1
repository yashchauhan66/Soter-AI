$ErrorActionPreference='Stop'
$taskRoot=$env:SOTERAI_F26C_PROFILE
if($taskRoot -cnotmatch '^D:\\SoterAI-Lite-test-profiles\\f26c-policy-probe-[0-9TZ]+-[a-f0-9]{8}$'){throw 'Synthetic root required.'}
foreach($taskName in @('HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME')){if(-not ([Environment]::GetEnvironmentVariable($taskName)).StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Synthetic environment required.'}}
if([IO.File]::ReadAllText((Join-Path $taskRoot '.synthetic-only')) -cne 'f26c-policy-probe-v1'){throw 'Synthetic marker required.'}
Import-Module -Name 'C:\Program Files\WindowsPowerShell\Modules\PSReadLine\2.0.0\PSReadLine.psd1' -Force
$taskOriginal=Get-PSReadLineOption
if(-not $taskOriginal.HistorySavePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'No real history permitted.'}
$taskPath=Join-Path $taskRoot 'history\policy.txt'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath))
Set-PSReadLineOption -HistorySavePath $taskPath -HistorySaveStyle SaveIncrementally
$taskScript=Join-Path $taskRoot 'generated-history.ps1'
$taskCases=[Collections.Generic.List[object]]::new()
function Test-Decision([string]$id,[scriptblock]$prior,[string]$line,[string]$expected){
 Set-PSReadLineOption -AddToHistoryHandler $prior
 . $taskScript
 $taskCurrent=Get-PSReadLineOption
 $taskActual=$taskCurrent.AddToHistoryHandler.Invoke($line)
 $taskOK=($taskActual -is [Microsoft.PowerShell.AddToHistoryOption] -and $taskActual.ToString() -ceq $expected -and $taskCurrent.HistorySavePath -ceq $taskPath -and $taskCurrent.HistorySaveStyle.ToString() -ceq 'SaveIncrementally')
 $taskCases.Add(@{id=$id;pass=$taskOK;expected=$expected;actual=$taskActual.ToString();pathAndStylePreserved=($taskCurrent.HistorySavePath -ceq $taskPath -and $taskCurrent.HistorySaveStyle.ToString() -ceq 'SaveIncrementally')})
}
$taskPublic='git status --short'
$taskCanary='ghp_A9b8C7d6E5f4G3h2I1j0K9l8M7n6O5p4'
Test-Decision 'P01-public-true' {$true} $taskPublic 'MemoryAndFile'
Test-Decision 'P02-public-false' {$false} $taskPublic 'SkipAdding'
Test-Decision 'P03-prior-memory-only' {[Microsoft.PowerShell.AddToHistoryOption]::MemoryOnly} $taskPublic 'MemoryOnly'
Test-Decision 'P04-prior-enum-skip' {[Microsoft.PowerShell.AddToHistoryOption]::SkipAdding} $taskPublic 'SkipAdding'
Test-Decision 'P05-prior-enum-file' {[Microsoft.PowerShell.AddToHistoryOption]::MemoryAndFile} $taskPublic 'MemoryAndFile'
Test-Decision 'P06-prior-string-memory-only' {'MemoryOnly'} $taskPublic 'MemoryOnly'
Test-Decision 'P07-prior-string-skip' {'SkipAdding'} $taskPublic 'SkipAdding'
Test-Decision 'P08-prior-string-file' {'MemoryAndFile'} $taskPublic 'MemoryAndFile'
Test-Decision 'P09-prior-invalid-enum' {[Microsoft.PowerShell.AddToHistoryOption]99} $taskPublic 'SkipAdding'
Test-Decision 'P10-prior-unknown-string' {'0'} $taskPublic 'SkipAdding'
Test-Decision 'P11-prior-object' {@{unsafe='object'}} $taskPublic 'SkipAdding'
Test-Decision 'P12-prior-throws' {throw 'FAKE_ONLY_CALLBACK_EXCEPTION'} $taskPublic 'SkipAdding'
Test-Decision 'P13-provider-secret' {$true} ('Write-Output '+$taskCanary) 'SkipAdding'
Test-Decision 'P14-assigned-secret' {$true} 'api_key=Z9a8Y7b6X5c4W3d2V1e0U9f8T7g6S5h4' 'SkipAdding'
Test-Decision 'P15-password' {$true} '$password="Synthetic1Credential"' 'SkipAdding'
Test-Decision 'P16-multiline-secret' {$true} ("Write-Output public`n"+$taskCanary) 'SkipAdding'
Test-Decision 'P17-empty' {$true} '' 'SkipAdding'
Test-Decision 'P18-whitespace' {$true} '   ' 'SkipAdding'
Test-Decision 'P19-oversize' {$true} ('z'*4097) 'SkipAdding'
Test-Decision 'P20-boundary-public' {$true} ('z'*4096) 'MemoryAndFile'
Test-Decision 'P21-nul' {$true} ('public'+[char]0) 'SkipAdding'
Test-Decision 'P22-public-unicode' {$true} ('Write-Output caf'+[char]0xe9) 'MemoryAndFile'
Test-Decision 'P23-unknown-case' {'memoryonly'} $taskPublic 'SkipAdding'
Test-Decision 'P24-prior-array' {$true; $false} $taskPublic 'SkipAdding'
Test-Decision 'P25-previous-deny-public' {$false} 'Get-ChildItem src' 'SkipAdding'
Test-Decision 'P26-public-files' {$true} 'Get-ChildItem src' 'MemoryAndFile'
Set-PSReadLineOption -AddToHistoryHandler {$true}
$taskMutation=(Get-PSReadLineOption).AddToHistoryHandler.Invoke('Write-Output '+$taskCanary)
$taskCases.Add(@{id='P27-no-hook-mutation-canary-allowed';pass=($taskMutation -is [bool] -and $taskMutation -eq $true);expected='UNGUARDED_TRUE';actual=$taskMutation.ToString();pathAndStylePreserved=$true})
$taskFailed=@($taskCases|Where-Object{-not $_.pass})
@{schemaVersion=1;scope='ACTUAL_GENERATED_DOTNET_CALLBACK_ONLY_NO_HISTORY_PERSISTENCE_OR_HOST';cases=@($taskCases);total=$taskCases.Count;pass=$taskCases.Count-$taskFailed.Count;fail=$taskFailed.Count;signalsRequested=0;realProfileOrHistoryReads=0;historyFileCreated=[IO.File]::Exists($taskPath)}|ConvertTo-Json -Depth 7 -Compress
if($taskFailed.Count -gt 0){exit 1}
