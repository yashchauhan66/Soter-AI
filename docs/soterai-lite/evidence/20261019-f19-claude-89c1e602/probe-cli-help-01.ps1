$ErrorActionPreference='Stop'
$taskPin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-01.json') -Raw|ConvertFrom-Json
$taskBinary=$taskPin.files|Where-Object {$_.relative -eq 'resources/native-binary/claude.exe'}
if((Get-FileHash -LiteralPath $taskBinary.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBinary.sha256){throw 'Public native runtime pin changed'}
$taskRoot=[IO.Path]::GetFullPath((Join-Path 'D:/SoterAI-Lite-test-profiles' ('f19-cli-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))))
if(-not $taskRoot.StartsWith('D:\SoterAI-Lite-test-profiles\f19-cli-',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRoot)){throw 'Fresh owned synthetic root required'}
$taskProfile=Join-Path $taskRoot 'profile';$taskWorkspace=Join-Path $taskRoot 'workspace'
foreach($taskFolder in @($taskWorkspace,(Join-Path $taskProfile 'Temp'),(Join-Path $taskProfile 'claude'))){[void][IO.Directory]::CreateDirectory($taskFolder)}
function Write-F19New([string]$Path,[string]$Text){$taskStream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($Text);$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}}
$taskGitConfig=Join-Path $taskRoot 'empty-git-config';Write-F19New $taskGitConfig ''
$taskRows=@()
foreach($taskMode in @('version','help')){
 $taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskBinary.path;$taskInfo.Arguments='--'+$taskMode;$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardInput=$true;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
 $taskEnv=@{USERPROFILE=$taskProfile;HOME=$taskProfile;APPDATA=(Join-Path $taskProfile 'AppData/Roaming');LOCALAPPDATA=(Join-Path $taskProfile 'AppData/Local');TEMP=(Join-Path $taskProfile 'Temp');TMP=(Join-Path $taskProfile 'Temp');CLAUDE_CONFIG_DIR=(Join-Path $taskProfile 'claude');PATH='C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0;C:/Program Files/Git/cmd;C:/Program Files/nodejs';GIT_CONFIG_NOSYSTEM='1';GIT_CONFIG_GLOBAL=$taskGitConfig;GIT_TERMINAL_PROMPT='0';GCM_INTERACTIVE='never';CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1';DISABLE_AUTOUPDATER='1';DISABLE_TELEMETRY='1';DISABLE_ERROR_REPORTING='1';CLAUDE_CODE_DISABLE_AUTO_MEMORY='1';CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY='1';DISABLE_INSTALLATION_CHECKS='1';DO_NOT_TRACK='1';CI='1';CLAUDE_CODE_SKIP_PROMPT_HISTORY='1'}
 foreach($taskKey in $taskEnv.Keys){$taskInfo.EnvironmentVariables[$taskKey]=$taskEnv[$taskKey]}
 $taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
 try{[void]$taskProcess.Start();$taskProcess.StandardInput.Close();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskClosed=$taskProcess.WaitForExit(15000)
  if(-not $taskClosed){throw 'INCOMPLETE: native help process retained without signals'}
  $taskOutput=$taskOut.GetAwaiter().GetResult();$taskError=$taskErr.GetAwaiter().GetResult();if($taskOutput.Length -gt 65536 -or $taskError.Length -gt 8192){throw 'INCOMPLETE: unexpected public help output size'}
  Write-F19New (Join-Path $PSScriptRoot ('cli-'+$taskMode+'-01.txt')) $taskOutput;Write-F19New (Join-Path $PSScriptRoot ('cli-'+$taskMode+'-stderr-01.txt')) $taskError
  $taskRows+=@{mode=$taskMode;exitCode=$taskProcess.ExitCode;naturalClose=$true;stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;outputSha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot ('cli-'+$taskMode+'-01.txt')) -Algorithm SHA256).Hash.ToLowerInvariant()}
 }finally{$taskProcess.Dispose()}
}
if((Get-FileHash -LiteralPath $taskBinary.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskBinary.sha256){throw 'Native runtime bytes changed'}
$taskResult=@{status='PUBLIC_CLI_PREPARATION_NOT_ROUTE_EVIDENCE';version=$taskPin.version;executionRoot=$taskRoot;binary=$taskBinary;rows=$taskRows;independence='LOW';scope='Actual pinned executable/version/help; minimal fresh synthetic profile; no authentication/agent request. Documented telemetry/update opt-outs are not OS or descendant traffic certification.'}
Write-F19New (Join-Path $PSScriptRoot 'cli-preparation-01.json') ($taskResult|ConvertTo-Json -Depth 8)
$taskResult|ConvertTo-Json -Depth 5
if(@($taskRows|Where-Object {$_.exitCode -ne 0}).Count -gt 0){throw 'Native public CLI help/version failed'}
