$ErrorActionPreference='Stop'
$taskRoot=$env:SOTERAI_F26C_PROFILE
if($taskRoot -cnotmatch '^D:\\SoterAI-Lite-test-profiles\\f26c-psreadline-probe-[0-9TZ]+-[a-f0-9]{8}$'){throw 'Synthetic profile required.'}
foreach($taskName in @('HOME','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','XDG_CONFIG_HOME','XDG_DATA_HOME')){
 $taskValue=[Environment]::GetEnvironmentVariable($taskName)
 if(-not $taskValue.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Synthetic environment required.'}
}
if([IO.File]::ReadAllText((Join-Path $taskRoot '.synthetic-only')) -cne 'f26c-api-probe-v1'){throw 'Synthetic marker required.'}
$taskModule='C:\Program Files\WindowsPowerShell\Modules\PSReadLine\2.0.0\PSReadLine.psd1'
Import-Module -Name $taskModule -Force -ErrorAction Stop
$taskModuleInfo=Get-Module -Name PSReadLine
if($taskModuleInfo.Version.ToString() -cne '2.0.0' -or $taskModuleInfo.ModuleBase -cne (Split-Path -Parent $taskModule)){throw 'Pinned module required.'}
$taskBefore=Get-PSReadLineOption
if(-not $taskBefore.HistorySavePath.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Default history path escaped synthetic profile.'}
$taskPath=Join-Path $taskRoot 'history\probe_history.txt'
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskPath))
Set-PSReadLineOption -HistorySavePath $taskPath -HistorySaveStyle SaveIncrementally
$taskPublic='Write-Output public_history_fixture_01'
$taskSecret='soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31'
Set-PSReadLineOption -AddToHistoryHandler {param([string]$line) $line -cne 'soterai_token=FAKE_ONLY_F26C_SECRET_VALUE_97aa31'}
$taskOption=Get-PSReadLineOption
if($taskOption.HistorySavePath -cne $taskPath){throw 'Exact synthetic history path required.'}
$taskHandler=$taskOption.AddToHistoryHandler
$taskPublicReturn=$taskHandler.Invoke($taskPublic)
$taskSecretReturn=$taskHandler.Invoke($taskSecret)
[Microsoft.PowerShell.PSConsoleReadLine]::AddToHistory($taskPublic)
[Microsoft.PowerShell.PSConsoleReadLine]::AddToHistory($taskSecret)
$taskMemory=@([Microsoft.PowerShell.PSConsoleReadLine]::GetHistoryItems())
$taskExists=[IO.File]::Exists($taskPath)
$taskHistory=if($taskExists){if((Get-Item -LiteralPath $taskPath).Length -gt 131072){throw 'Synthetic history bound.'};[IO.File]::ReadAllText($taskPath)}else{''}
$taskEnum=[Microsoft.PowerShell.PSConsoleReadLine].Assembly.GetType('Microsoft.PowerShell.AddToHistoryOption')
$taskOutput=@{
 schemaVersion=1;scope='ACTUAL_INSTALLED_API_SYNTHETIC_DIRECT_ADD_NOT_INTERACTIVE_TERMINAL';syntheticOnly=$true;moduleVersion=$taskModuleInfo.Version.ToString();powerShellVersion=$PSVersionTable.PSVersion.ToString()
 handlerParameterType=(Get-Command Set-PSReadLineOption).Parameters['AddToHistoryHandler'].ParameterType.FullName
 handlerRuntimeType=$taskHandler.GetType().FullName;publicHandlerResult=[bool]$taskPublicReturn;secretHandlerResult=[bool]$taskSecretReturn
 enumPresent=($null -ne $taskEnum);enumNames=$(if($taskEnum){@([Enum]::GetNames($taskEnum))}else{@()})
 memoryPublicPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskPublic}).Count -gt 0);memorySecretPresent=(@($taskMemory|Where-Object{$_.CommandLine -ceq $taskSecret}).Count -gt 0)
 historyFileCreated=$taskExists;filePublicPresent=$taskHistory.Contains($taskPublic);fileSecretPresent=$taskHistory.Contains($taskSecret);historyBytes=$([Text.Encoding]::UTF8.GetByteCount($taskHistory));profileOrRealHistoryReads=0;signalsRequested=0
}
$taskOutput|ConvertTo-Json -Depth 6 -Compress
