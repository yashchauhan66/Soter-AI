Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Find VS Code window
$codeProcesses = Get-Process -Name "Code" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }
if (-not $codeProcesses) {
    Write-Host "No VS Code window found"
    exit 1
}
$proc = $codeProcesses[0]
$hwnd = $proc.MainWindowHandle

# Get window rect using Win32 API
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

$rect = New-Object Win32+RECT
[Win32]::GetWindowRect($hwnd, [ref]$rect)
Write-Host "VS Code window: Left=$($rect.Left) Top=$($rect.Top) Right=$($rect.Right) Bottom=$($rect.Bottom) Width=$($rect.Right - $rect.Left) Height=$($rect.Bottom - $rect.Top)"

$screenshotsDir = "packages\vscode-extension\media\screenshots"
$files = @("dashboard-overview.png", "scan-results.png", "command-palette.png", "settings-panel.png")

foreach ($file in $files) {
    $path = Join-Path $screenshotsDir $file
    if (-not (Test-Path $path)) {
        Write-Host "SKIP: $file not found"
        continue
    }
    
    $original = [System.Drawing.Image]::FromFile((Resolve-Path $path))
    Write-Host "$file`: $($original.Width) x $($original.Height)"
    
    # Crop to window bounds (clamped to image size)
    $cropX = [Math]::Max(0, $rect.Left)
    $cropY = [Math]::Max(0, $rect.Top)
    $cropW = [Math]::Min($rect.Right - $rect.Left, $original.Width - $cropX)
    $cropH = [Math]::Min($rect.Bottom - $rect.Top, $original.Height - $cropY)
    
    if ($cropW -le 0 -or $cropH -le 0) {
        Write-Host "SKIP CROP: Invalid crop dimensions for $file"
        $original.Dispose()
        continue
    }
    
    $rect2 = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $cropped = $original.Clone($rect2, $original.PixelFormat)
    $original.Dispose()
    
    $cropped.Save($path)
    Write-Host "CROPPED $file`: $($cropped.Width) x $($cropped.Height)"
    $cropped.Dispose()
}

Write-Host "Done cropping all screenshots"
