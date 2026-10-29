$ErrorActionPreference = 'Stop'
$taskRecovery = 'D:\SoterAI-Lite-test-profiles\f26b-vscode-update-recovery-20261029-01'
$taskPrior = Get-Content -LiteralPath "$taskRecovery\installer-retry-action-01.json" -Raw | ConvertFrom-Json
$taskInstaller = 'C:\Users\USER\AppData\Local\Temp\vscode-stable-user-x64\CodeSetup-stable-2c33b50b16c472efe58357d1d2a8a5414bc23fbf.exe'
if ($taskPrior.installer -ne $taskInstaller) { throw 'Installer path mismatch' }
$taskSignature = Get-AuthenticodeSignature -LiteralPath $taskInstaller
if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch '^CN=Microsoft Corporation,') { throw 'Signature refused' }
if ((Get-FileHash -LiteralPath $taskInstaller -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskPrior.installerSha256) { throw 'Installer changed' }
$taskProcess = Get-CimInstance Win32_Process -Filter 'ProcessId=7308'
if ($null -eq $taskProcess -or $taskProcess.Name -ne 'CodeSetup-stable-2c33b50b16c472efe58357d1d2a8a5414bc23fbf.tmp') { throw 'Installer owner changed' }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class SoterInstallerControl04 { [DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); }'
$taskCondition = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty, 7308)
$taskWindows = [Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children, $taskCondition)
if ($taskWindows.Count -ne 1 -or $taskWindows[0].Current.Name -ne 'Error') { throw 'Expected single installer error dialog absent; no action' }
$taskDialog = $taskWindows[0]
if ($taskDialog.Current.ClassName -ne '#32770' -or $taskDialog.Current.NativeWindowHandle -eq 0) { throw 'Native task dialog class refused' }
$taskText = $taskDialog.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty, 'ContentText')))
if ($null -eq $taskText -or -not $taskText.Current.Name.StartsWith('C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\new_Code.exe') -or $taskText.Current.Name -notmatch 'There is not enough space on the disk\.') { throw 'Exact disk-full dialog refused' }
$taskRetry = $taskDialog.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty, 'CommandLink_4')))
if ($null -eq $taskRetry -or $taskRetry.Current.Name -ne 'Try again' -or $taskRetry.Current.ClassName -ne 'CCCommandLink' -or -not $taskRetry.Current.IsEnabled -or $taskRetry.Current.NativeWindowHandle -eq 0) { throw 'Exact Retry button refused' }
$taskRecord = [ordered]@{
    observedAt = [DateTime]::UtcNow.ToString('o')
    authority = 'Explicit user VS Code update request and disposable cache cleanup authorization'
    installer = $taskInstaller
    installerSha256 = $taskPrior.installerSha256
    signature = [string]$taskSignature.Status
    signer = $taskSignature.SignerCertificate.Subject
    targetPid = 7308
    processCreationDate = $taskProcess.CreationDate
    dialog = $taskText.Current.Name
    retryHandle = $taskRetry.Current.NativeWindowHandle
    dialogHandle = $taskDialog.Current.NativeWindowHandle
    apiReference = 'https://learn.microsoft.com/en-us/windows/win32/controls/tdm-click-button'
    action = 'One documented TDM_CLICK_BUTTON message (WM_USER+102), button4, exact verified existing installer task dialog; no global input'
    freeBytesBefore = (Get-PSDrive C).Free
    newInstallerStarted = $false
    processSignalsRequested = 0
}
$taskRecord | ConvertTo-Json -Depth 6 | Out-File -LiteralPath "$taskRecovery\installer-retry-action-04.json" -Encoding utf8 -NoClobber
if (-not [SoterInstallerControl04]::PostMessage([IntPtr]$taskDialog.Current.NativeWindowHandle, 0x0466, [IntPtr]4, [IntPtr]::Zero)) { throw 'Retry dispatch failed' }
[ordered]@{status='ONE_VERIFIED_INSTALLER_RETRY04_DISPATCHED_NOT_YET_COMPLETE';pid=7308;freeBytesBefore=$taskRecord.freeBytesBefore} | ConvertTo-Json
