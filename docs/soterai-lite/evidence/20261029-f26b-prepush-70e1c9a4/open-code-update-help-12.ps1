$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SoterUpdateHelp12 {
 [StructLayout(LayoutKind.Sequential)] public struct Key { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
 [StructLayout(LayoutKind.Explicit, Size=32)] public struct Union { [FieldOffset(0)] public Key key; }
 [StructLayout(LayoutKind.Sequential)] public struct Input { public uint type; public Union data; }
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, Input[] inputs, int size);
 static Input Event(ushort key, uint flags) { return new Input { type=1, data=new Union { key=new Key { vk=key, flags=flags } } }; }
 public static uint OpenHelp() {
  IntPtr hwnd=new IntPtr(262958); uint pid; GetWindowThreadProcessId(hwnd,out pid);
  if(pid!=13176 || Marshal.SizeOf(typeof(Input))!=40) throw new InvalidOperationException("Owner/input layout refused");
  if((GetAsyncKeyState(0x10)&0x8000)!=0 || (GetAsyncKeyState(0x11)&0x8000)!=0 || (GetAsyncKeyState(0x12)&0x8000)!=0) throw new InvalidOperationException("User modifier active; no input");
  if(!SetForegroundWindow(hwnd) || GetForegroundWindow()!=hwnd) throw new InvalidOperationException("Foreground refused; no input");
  return SendInput(4,new[]{Event(0x12,0),Event(0x48,0),Event(0x48,2),Event(0x12,2)},40);
 }
}
'@
$taskRecovery='D:\SoterAI-Lite-test-profiles\f26b-vscode-update-recovery-20261029-01'
[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');authority='Explicit requested VS Code update';action='One Alt+H to exact foreground verified Code owner to locate official update menu';pid=13176;hwnd=262958;restartRequested=$false;editorContentRead=$false;processSignalsRequested=0} | ConvertTo-Json | Out-File -LiteralPath "$taskRecovery\code-help-input-action-12.json" -Encoding utf8 -NoClobber
$taskCount=[SoterUpdateHelp12]::OpenHelp()
$taskResult=[ordered]@{observedAt=[DateTime]::UtcNow.ToString('o');insertedInputEvents=$taskCount;expected=4;lastWin32Error=[Runtime.InteropServices.Marshal]::GetLastWin32Error();restartRequested=$false}
$taskResult | ConvertTo-Json | Out-File -LiteralPath "$taskRecovery\code-help-input-result-12.json" -Encoding utf8 -NoClobber
$taskResult | ConvertTo-Json
if($taskCount -ne 4){throw 'Input delivery incomplete; no repeat or follow-up action'}
