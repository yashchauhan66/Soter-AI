param([Parameter(Mandatory=$true)][string]$RunRoot,[Parameter(Mandatory=$true)][string]$CodePath)
$ErrorActionPreference='Stop'
$RunRoot=[IO.Path]::GetFullPath($RunRoot)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if(-not $RunRoot.StartsWith((Join-Path $repoRoot '.tmp/pv-final/native')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Native output outside named test root.'}
$freeze=Get-Content -LiteralPath (Join-Path $RunRoot 'freeze.json') -Raw | ConvertFrom-Json
if(-not $freeze.syntheticOnly -or $freeze.phase -ne 1){throw 'Invalid native fixture freeze.'}
$workspace=Join-Path $RunRoot 'workspace'
$profile=Join-Path $RunRoot 'profile'
$snapshot=Join-Path $RunRoot 'snapshot'
$tests=Join-Path $RunRoot 'native-baseline.js'
$listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
$listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop()
$settings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;
    'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
    'soterai.broker.port'=$port;'soterai.broker.openAIProviderUrl'='';'soterai.broker.anthropicProviderUrl'=''}
[IO.File]::WriteAllText((Join-Path $profile 'User/settings.json'),($settings|ConvertTo-Json))
$launch=@{syntheticOnly=$true;normalProfile=$false;harnessSha256=(Get-FileHash -LiteralPath $tests).Hash.ToLowerInvariant();
    codeSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant();port=$port;runId=$freeze.runId}
[IO.File]::WriteAllText((Join-Path $RunRoot 'user-launch.json'),($launch|ConvertTo-Json))
$info=New-Object Diagnostics.ProcessStartInfo
$info.FileName=[IO.Path]::GetFullPath($CodePath)
$taskLaunchArguments=@("--extensionDevelopmentPath=$snapshot","--extensionTestsPath=$tests","--user-data-dir=$profile",
    "--extensions-dir=$(Join-Path $RunRoot 'extensions')",'--disable-extensions','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$workspace)
$info.Arguments=(($taskLaunchArguments|ForEach-Object{if($_ -match '"'){throw 'Invalid argument.'};'"'+$_+'"'})-join ' ')
$info.WorkingDirectory=$workspace;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
foreach($name in @('SystemRoot','WINDIR','TEMP','TMP','COMSPEC')){$value=[Environment]::GetEnvironmentVariable($name);if($value){$info.EnvironmentVariables[$name]=$value}}
$info.EnvironmentVariables['USERPROFILE']=$profile
$info.EnvironmentVariables['APPDATA']=Join-Path $profile 'AppData/Roaming'
$info.EnvironmentVariables['LOCALAPPDATA']=Join-Path $profile 'AppData/Local'
$info.EnvironmentVariables['SOTERAI_PHASE1_RUN']=$RunRoot
$git=Get-Command git.exe -ErrorAction SilentlyContinue
if($git){$info.EnvironmentVariables['SOTERAI_PHASE1_GIT']=$git.Source}
$process=New-Object Diagnostics.Process;$process.StartInfo=$info
try{
    [void]$process.Start();$stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    $elapsed=[Diagnostics.Stopwatch]::StartNew()
    while(-not $process.WaitForExit(1000) -and $elapsed.Elapsed.TotalSeconds -lt 120){}
    $timedOut=-not $process.HasExited
    $stdoutText=if($stdout.IsCompleted){$stdout.GetAwaiter().GetResult()}else{'INCOMPLETE: stdout drain pending.'}
    $stderrText=if($stderr.IsCompleted){$stderr.GetAwaiter().GetResult()}else{'INCOMPLETE: stderr drain pending.'}
    [IO.File]::WriteAllText((Join-Path $RunRoot 'stdout.txt'),$stdoutText);[IO.File]::WriteAllText((Join-Path $RunRoot 'stderr.txt'),$stderrText)
    $stdoutText;$stderrText;Write-Output ('Native evidence: '+$RunRoot)
    if($timedOut){throw 'INCOMPLETE: existing NativeBaseline timeout; every Code.exe retained.'}
    $hostExit=$process.ExitCode
}finally{$process.Dispose()}
exit $hostExit
