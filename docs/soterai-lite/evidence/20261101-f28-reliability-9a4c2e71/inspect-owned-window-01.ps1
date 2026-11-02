param([switch]$InvokeDiscard,[ValidatePattern('^owned-window-dialog-[0-9]{2}\.json$')][string]$OutputName='owned-window-dialog-01.json')
$ErrorActionPreference='Stop'
$taskDirs=@(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter 'f28-reliability-native-*');if($taskDirs.Count -ne 1){throw 'Exactly one current native root required.'}
$taskStart=Get-Content -LiteralPath (Join-Path $taskDirs[0].FullName 'primary-owned-editor-start.json') -Raw|ConvertFrom-Json
$taskFreeze=Get-Content -LiteralPath (Join-Path $taskDirs[0].FullName 'freeze.json') -Raw|ConvertFrom-Json
$taskMarker=Join-Path $taskFreeze.workspace '.synthetic-lite-f28-host';if((Get-Content -LiteralPath $taskMarker -Raw) -cne 'synthetic-only-v1'){throw 'Owned synthetic workspace marker required.'}
$taskProcess=Get-Process -Id $taskStart.pid -ErrorAction SilentlyContinue
$taskRecord=@{observedAt=[DateTime]::UtcNow.ToString('o');pid=$taskStart.pid;profile=$taskStart.profile;signalsRequested=0;normalProfileTouched=$false;action='READ_ONLY'}
if(-not $taskProcess){$taskRecord.status='ALREADY_ABSENT_NO_UI_ACTION'}else{
 $taskIdentity=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskStart.pid)
 if(-not $taskIdentity -or -not $taskIdentity.ExecutablePath.Equals($taskStart.executable,[StringComparison]::OrdinalIgnoreCase) -or -not $taskIdentity.CommandLine.ToLowerInvariant().Contains($taskStart.profile.ToLowerInvariant()) -or $taskProcess.StartTime.ToUniversalTime().ToString('o') -cne $taskStart.startUtc){throw 'Exact fresh owned PID/executable/profile/start identity required.'}
 if($taskProcess.MainWindowHandle -eq [IntPtr]::Zero){throw 'Owned main window handle unavailable.'}
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 $taskRoot=[Windows.Automation.AutomationElement]::FromHandle($taskProcess.MainWindowHandle)
 $taskCondition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Button)
 $taskButtons=$taskRoot.FindAll([Windows.Automation.TreeScope]::Descendants,$taskCondition)
 if($taskButtons.Count -gt 128){throw 'Owned UI button bound exceeded.'}
 $taskNames=@();$taskDiscard=@();for($taskIndex=0;$taskIndex -lt $taskButtons.Count;$taskIndex++){$taskButton=$taskButtons.Item($taskIndex);$taskName=$taskButton.Current.Name;$taskNames+=@{name=[string]$taskName;enabled=$taskButton.Current.IsEnabled};if($taskName -cin @("Don't Save","Don't Save Workspace") -and $taskButton.Current.IsEnabled){$taskDiscard+=,$taskButton}}
 $taskRecord.status='EXACT_OWNED_SYNTHETIC_WINDOW_INSPECTED';$taskRecord.buttons=$taskNames;$taskRecord.discardButtonCount=$taskDiscard.Count
 if($InvokeDiscard){if($taskDiscard.Count -ne 1){throw 'Exactly one explicit owned discard-workspace button required.'};$taskPattern=$taskDiscard[0].GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern);$taskPattern.Invoke();$taskRecord.action='INVOKED_DONT_SAVE_FOR_OWNED_SYNTHETIC_WORKSPACE_ONLY';$taskRecord.status='NORMAL_OWNED_UI_CLOSE_REQUESTED_EXIT_NOT_YET_CLAIMED'}
}
$taskOutput=Join-Path $PSScriptRoot $OutputName;if(Test-Path -LiteralPath $taskOutput){throw 'Evidence overwrite refused.'};[IO.File]::WriteAllText($taskOutput,($taskRecord|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false));$taskRecord|ConvertTo-Json -Depth 10
