$ErrorActionPreference='Stop'
$taskRoot=$env:SOTERAI_F26C_PROFILE
if($taskRoot -cnotmatch '^D:\\SoterAI-Lite-test-profiles\\f26c-console-probe-[0-9TZ]+-[a-f0-9]{8}$'){throw 'Synthetic profile required.'}
foreach($taskName in @('HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME')){
 $taskValue=[Environment]::GetEnvironmentVariable($taskName)
 if(-not $taskValue.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Synthetic environment required.'}
}
if([IO.File]::ReadAllText((Join-Path $taskRoot '.synthetic-only')) -cne 'f26c-console-probe-v4'){throw 'Synthetic marker required.'}
$taskModule='C:\Program Files\WindowsPowerShell\Modules\PSReadLine\2.0.0\PSReadLine.psd1'
Import-Module -Name $taskModule -Force -ErrorAction Stop
$taskModuleInfo=Get-Module -Name PSReadLine
if($taskModuleInfo.Version.ToString() -cne '2.0.0' -or $taskModuleInfo.ModuleBase -cne (Split-Path -Parent $taskModule)){throw 'Pinned module required.'}
$taskBefore=Get-PSReadLineOption
if(-not $taskBefore.HistorySavePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Default history escaped synthetic profile.'}
$taskPath=Join-Path $taskRoot 'history\probe_history.txt'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath))
Set-PSReadLineOption -HistorySavePath $taskPath -HistorySaveStyle SaveIncrementally
Set-PSReadLineOption -AddToHistoryHandler {param([string]$line) if($line -ceq 'Write-Output memory_only_public_04'){return [Microsoft.PowerShell.AddToHistoryOption]::MemoryOnly}; return $true}
. (Join-Path $taskRoot 'generated-history.ps1')
$taskOption=Get-PSReadLineOption
if($taskOption.HistorySavePath -cne $taskPath){throw 'Exact synthetic history path required.'}
$taskPublic='Write-Output public_history_fixture_04'
$taskSecret='Write-Output ghp_A9b8C7d6E5f4G3h2I1j0K9l8M7n6O5p4'
$taskEnum=[Microsoft.PowerShell.PSConsoleReadLine].Assembly.GetType('Microsoft.PowerShell.AddToHistoryOption')
$taskMetadata=@{schemaVersion=1;scope='ACTUAL_INSTALLED_PUBLIC_READLINE_CONSOLE_PROBE_NOT_PRODUCT';moduleVersion=$taskModuleInfo.Version.ToString();powerShellVersion=$PSVersionTable.PSVersion.ToString();handlerParameterType=(Get-Command Set-PSReadLineOption).Parameters['AddToHistoryHandler'].ParameterType.FullName;handlerRuntimeType=$taskOption.AddToHistoryHandler.GetType().FullName;publicHandlerResult=$taskOption.AddToHistoryHandler.Invoke($taskPublic);secretHandlerResult=$taskOption.AddToHistoryHandler.Invoke($taskSecret);enumNames=@([Enum]::GetNames($taskEnum));inputRedirected=[Console]::IsInputRedirected;outputRedirected=[Console]::IsOutputRedirected;historyPersistence='NOT_RUN';realProfileOrHistoryReads=0;signalsRequested=0}
[IO.File]::WriteAllText((Join-Path $taskRoot 'api-metadata.json'),($taskMetadata|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
if([Console]::IsInputRedirected -or [Console]::IsOutputRedirected){throw 'Real inherited console required; metadata retained.'}
$taskTimeout=[Threading.CancellationTokenSource]::new(120000)
try{
 Write-Host 'F26C_READY_PUBLIC_04'
 $taskReadPublic=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 [IO.File]::WriteAllText((Join-Path $taskRoot 'read-observation.json'),(@{stage='public-return';returnedChars=$taskReadPublic.Length;cancellationRequested=$taskTimeout.IsCancellationRequested;observedAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 if($taskReadPublic -cne $taskPublic){throw 'Exact public fixture required.'}
 Write-Host 'F26C_READY_SECRET_04'
 $taskReadSecret=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 if($taskReadSecret -cne $taskSecret){throw 'Exact synthetic negative fixture required.'}
 Write-Host 'F26C_READY_MEMORY_ONLY_04'
 $taskReadMemory=[Microsoft.PowerShell.PSConsoleReadLine]::ReadLine($Host.Runspace,$ExecutionContext,$taskTimeout.Token)
 if($taskReadMemory -cne 'Write-Output memory_only_public_04'){throw 'Exact memory-only public fixture required.'}
 $taskMemory=@([Microsoft.PowerShell.PSConsoleReadLine]::GetHistoryItems())
 $taskStat=Get-Item -LiteralPath $taskPath
 if($taskStat.Length -gt 131072){throw 'Synthetic history bound.'}
 $taskHistory=[IO.File]::ReadAllText($taskPath)
 $taskResult=@{schemaVersion=1;scope='ACTUAL_GENERATED_HISTORY_CALLBACK_PUBLIC_READLINE_PERSISTENCE_COMPONENT_ONLY';publicReturned=($taskReadPublic -ceq $taskPublic);secretReturned=($taskReadSecret -ceq $taskSecret);publicMemoryPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskPublic}).Count -eq 1);secretMemoryAbsent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskSecret}).Count -eq 0);publicFilePresent=$taskHistory.Contains($taskPublic);secretFileAbsent=(-not $taskHistory.Contains($taskSecret));memoryOnlyPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq 'Write-Output memory_only_public_04'}).Count -eq 1);memoryOnlyFileAbsent=(-not $taskHistory.Contains('Write-Output memory_only_public_04'));historyBytes=$taskStat.Length;commandsExecuted=0;realProfileOrHistoryReads=0;privateReflectionOrMock=0;signalsRequested=0}
 [IO.File]::WriteAllText((Join-Path $taskRoot 'console-result.json'),($taskResult|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 foreach($taskCheck in @('publicReturned','secretReturned','publicMemoryPresent','secretMemoryAbsent','publicFilePresent','secretFileAbsent','memoryOnlyPresent','memoryOnlyFileAbsent')){if($taskResult[$taskCheck] -ne $true){throw 'History mechanism assertion failed.'}}
 Write-Host 'F26C_CONSOLE_MECHANISM_PASS_04'
}finally{$taskTimeout.Dispose()}
