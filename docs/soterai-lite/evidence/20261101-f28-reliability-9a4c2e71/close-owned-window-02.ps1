$ErrorActionPreference='Stop'
# The shared inspector re-verifies marker, exact fresh PID/start/executable/profile
# and returns only this synthetic window's UI Automation root. No global keys.
. (Join-Path $PSScriptRoot 'inspect-owned-window-01.ps1') -OutputName 'owned-window-dialog-02.json'|Out-Null
$taskCloseRecord=@{observedAt=[DateTime]::UtcNow.ToString('o');pid=$taskStart.pid;profile=$taskStart.profile;signalsRequested=0;normalProfileTouched=$false;exitConfirmed=$false}
if($taskRecord.status -ceq 'ALREADY_ABSENT_NO_UI_ACTION'){$taskCloseRecord.action='NO_ACTION_ALREADY_ABSENT'}else{
 $taskCloseButtons=@();for($taskIndex=0;$taskIndex -lt $taskButtons.Count;$taskIndex++){$taskButton=$taskButtons.Item($taskIndex);if($taskButton.Current.Name -ceq 'Close' -and $taskButton.Current.IsEnabled){$taskCloseButtons+=,$taskButton}}
 if($taskCloseButtons.Count -ne 1){throw 'Exactly one normal owned Close button required.'}
 $taskInvoke=$null
 if($taskCloseButtons[0].TryGetCurrentPattern([Windows.Automation.InvokePattern]::Pattern,[ref]$taskInvoke)){$taskInvoke.Invoke();$taskCloseRecord.action='INVOKED_NORMAL_OWNED_CLOSE_BUTTON'}else{$taskWindow=$taskRoot.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern);$taskWindow.Close();$taskCloseRecord.action='REQUESTED_NORMAL_OWNED_WINDOW_CLOSE'}
}
$taskCloseFile=Join-Path $PSScriptRoot 'owned-window-close-action-02.json';if(Test-Path -LiteralPath $taskCloseFile){throw 'Evidence overwrite refused.'};[IO.File]::WriteAllText($taskCloseFile,($taskCloseRecord|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false));$taskCloseRecord|ConvertTo-Json -Depth 10
