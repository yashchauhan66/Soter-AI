# Read-only external updater observation; never acquire the mutex or stop the updater.
$ErrorActionPreference='Stop'
function Assert-ClineUpdaterIdle {
 $taskMutex=$null;$taskPresent=$false
 try{$taskMutex=[Threading.Mutex]::OpenExisting('vscode-updating');$taskPresent=$true}catch [Threading.WaitHandleCannotBeOpenedException]{$taskPresent=$false}finally{if($null -ne $taskMutex){$taskMutex.Dispose()}}
 if($taskPresent){throw 'CLINE_NATIVE_PREFLIGHT_UPDATER_BUSY_NO_CODE_LAUNCH'}
 $taskSetups=@(Get-Process -Name '*Code*Setup*','*Inno*' -ErrorAction SilentlyContinue)
 if($taskSetups.Count -gt 0){throw 'CLINE_NATIVE_PREFLIGHT_SETUP_PROCESS_PRESENT_NO_CODE_LAUNCH'}
}
