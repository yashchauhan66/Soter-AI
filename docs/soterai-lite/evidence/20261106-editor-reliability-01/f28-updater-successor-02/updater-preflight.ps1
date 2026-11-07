# Read-only preflight: open existing mutex handle without waiting/acquiring it; never modify/stop updater.
$ErrorActionPreference='Stop'
function Assert-F28UpdaterIdle {
 $taskMutex=$null;$taskPresent=$false
 try {$taskMutex=[Threading.Mutex]::OpenExisting('vscode-updating');$taskPresent=$true} catch [Threading.WaitHandleCannotBeOpenedException] {$taskPresent=$false} finally {if($null -ne $taskMutex){$taskMutex.Dispose()}}
 if($taskPresent){throw 'F28_NATIVE_PREFLIGHT_UPDATER_BUSY_NO_CODE_LAUNCH'}
 $taskActive=@(Get-Process -Name '*Code*Setup*','*Inno*' -ErrorAction SilentlyContinue)
 if($taskActive.Count -gt 0){throw 'F28_NATIVE_PREFLIGHT_SETUP_PROCESS_PRESENT_NO_CODE_LAUNCH'}
}
