$ErrorActionPreference='Stop'
$taskRoot=$env:SOTERAI_F26C_PROFILE
if($taskRoot -cnotmatch '^D:\\SoterAI-Lite-test-profiles\\f26c-console-probe-[0-9TZ]+-[a-f0-9]{8}$'){throw 'Synthetic profile required.'}
foreach($taskName in @('HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME')){
 $taskValue=[Environment]::GetEnvironmentVariable($taskName)
 if(-not $taskValue.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Synthetic environment required.'}
}
if([IO.File]::ReadAllText((Join-Path $taskRoot '.synthetic-only')) -cne 'f26c-console-probe-v2'){throw 'Synthetic marker required.'}
$taskModule='C:\Program Files\WindowsPowerShell\Modules\PSReadLine\2.0.0\PSReadLine.psd1'
Import-Module -Name $taskModule -Force -ErrorAction Stop
$taskModuleInfo=Get-Module -Name PSReadLine
if($taskModuleInfo.Version.ToString() -cne '2.0.0' -or $taskModuleInfo.ModuleBase -cne (Split-Path -Parent $taskModule)){throw 'Pinned module required.'}
$taskBefore=Get-PSReadLineOption
if(-not $taskBefore.HistorySavePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Default history escaped synthetic profile.'}
$taskPath=Join-Path $taskRoot 'history\probe_history.txt'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath))
Set-PSReadLineOption -HistorySavePath $taskPath -HistorySaveStyle SaveIncrementally
Set-PSReadLineOption -AddToHistoryHandler {param([string]$line) $line -cne 'soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31'}
$taskOption=Get-PSReadLineOption
if($taskOption.HistorySavePath -cne $taskPath){throw 'Exact synthetic history path required.'}
$taskPublic='Write-Output public_history_fixture_02'
$taskSecret='soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31'
$taskEnum=[Microsoft.PowerShell.PSConsoleReadLine].Assembly.GetType('Microsoft.PowerShell.AddToHistoryOption')
$taskMetadata=@{schemaVersion=1;scope='ACTUAL_INSTALLED_PUBLIC_READLINE_CONSOLE_PROBE_NOT_PRODUCT';moduleVersion=$taskModuleInfo.Version.ToString();powerShellVersion=$PSVersionTable.PSVersion.ToString();handlerParameterType=(Get-Command Set-PSReadLineOption).Parameters['AddToHistoryHandler'].ParameterType.FullName;handlerRuntimeType=$taskOption.AddToHistoryHandler.GetType().FullName;publicHandlerResult=$taskOption.AddToHistoryHandler.Invoke($taskPublic);secretHandlerResult=$taskOption.AddToHistoryHandler.Invoke($taskSecret);enumNames=@([Enum]::GetNames($taskEnum));inputRedirected=[Console]::IsInputRedirected;outputRedirected=[Console]::IsOutputRedirected;historyPersistence='NOT_RUN';realProfileOrHistoryReads=0;signalsRequested=0}
[IO.File]::WriteAllText((Join-Path $taskRoot 'api-metadata.json'),($taskMetadata|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
if([Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'Real inherited console required; metadata retained.'}
$taskTimeout=[Threading.CancellationTokenSource]::new(45000)
try{
 Write-Host 'F26C_READY_PUBLIC_02'
 $taskReadPublic=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 if($taskReadPublic -cne $taskPublic){throw 'Exact public fixture required.'}
 Write-Host 'F26C_READY_SECRET_02'
 $taskReadSecret=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 if($taskReadSecret -cne $taskSecret){throw 'Exact synthetic negative fixture required.'}
 $taskMemory=@([Microsoft.PowerShell.PSConsoleReadLine]::GetHistoryItems())
 $taskStat=Get-Item -LiteralPath $taskPath
 if($taskStat.Length -gt 131072){throw 'Synthetic history bound.'}
 $taskHistory=[IO.File]::ReadAllText($taskPath)
 $taskResult=@{schemaVersion=1;scope='ACTUAL_PUBLIC_READLINE_CONSOLE_MECHANISM_ONLY';publicReturned=($taskReadPublic -ceq $taskPublic);secretReturned=($taskReadSecret -ceq $taskSecret);publicMemoryPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskPublic}).Count -eq 1);secretMemoryAbsent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskSecret}).Count -eq 0);publicFilePresent=$taskHistory.Contains($taskPublic);secretFileAbsent=(-not $taskHistory.Contains($taskSecret));historyBytes=$taskStat.Length;commandsExecuted=0;realProfileOrHistoryReads=0;privateReflectionOrMock=0;signalsRequested=0}
 [IO.File]::WriteAllText((Join-Path $taskRoot 'console-result.json'),($taskResult|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 foreach($taskCheck in @('publicReturned','secretReturned','publicMemoryPresent','secretMemoryAbsent','publicFilePresent','secretFileAbsent')){if($taskResult[$taskCheck] -ne $true){throw 'History mechanism assertion failed.'}}
 Write-Host 'F26C_CONSOLE_MECHANISM_PASS_02'
}finally{$taskTimeout.Dispose()}
