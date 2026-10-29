$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SoterUpdateHelp10 {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
}
'@
$taskWindow = [Windows.Automation.AutomationElement]::FromHandle([IntPtr]262958)
if ($taskWindow.Current.ProcessId -ne 13176 -or $taskWindow.Current.ClassName -ne 'Chrome_WidgetWin_1') { throw 'Code owner changed' }
$taskProcess = Get-CimInstance Win32_Process -Filter 'ProcessId=13176'
if ($null -eq $taskProcess -or $taskProcess.ExecutablePath -ne 'C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe') { throw 'Code executable owner changed' }
$taskBar = $taskWindow.FindFirst([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::MenuBar)))
$taskHelp = $taskBar.FindFirst([Windows.Automation.TreeScope]::Children, (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, 'Help')))
if ($null -eq $taskHelp -or -not $taskHelp.Current.IsEnabled -or $taskHelp.Current.IsOffscreen) { throw 'Exact visible Help menu unavailable' }
$taskRect = $taskHelp.Current.BoundingRectangle
$taskX = [int]($taskRect.Left + $taskRect.Width / 2)
$taskY = [int]($taskRect.Top + $taskRect.Height / 2)
$taskRecord = [ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');authority='User explicitly requested official VS Code update';action='One owned visible Help-menu click only; locate normal updater action';pid=13176;windowHandle=262958;helpBounds=[string]$taskRect;x=$taskX;y=$taskY;editorContentRead=$false;processSignalsRequested=0}
$taskRecord | ConvertTo-Json | Out-File -LiteralPath 'D:\SoterAI-Lite-test-profiles\f26b-vscode-update-recovery-20261029-01\code-help-click-action-10.json' -Encoding utf8 -NoClobber
if (-not [SoterUpdateHelp10]::SetForegroundWindow([IntPtr]262958)) { throw 'Foreground activation refused; no input sent' }
if ([SoterUpdateHelp10]::GetForegroundWindow() -ne [IntPtr]262958) { throw 'Foreground changed; no input sent' }
if (-not [SoterUpdateHelp10]::SetCursorPos($taskX, $taskY)) { throw 'Cursor placement failed; no click sent' }
$taskPoint = New-Object SoterUpdateHelp10+Point
$taskPoint.X = $taskX
$taskPoint.Y = $taskY
$taskUnderPoint = [SoterUpdateHelp10]::WindowFromPoint($taskPoint)
if ([SoterUpdateHelp10]::GetAncestor($taskUnderPoint, 2) -ne [IntPtr]262958 -or [SoterUpdateHelp10]::GetForegroundWindow() -ne [IntPtr]262958) { throw 'Point/foreground owner changed; no click sent' }
[SoterUpdateHelp10]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[SoterUpdateHelp10]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Write-Output 'EXACT_OWNED_HELP_MENU_CLICK_SENT_NO_RESTART_OR_EDIT_ACTION'
