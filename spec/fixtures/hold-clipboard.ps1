param([int]$Milliseconds = 40)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClipboardLock {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateWindowEx(uint extendedStyle, string className, string name, uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("user32.dll")]
    public static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool OpenClipboard(IntPtr window);
    [DllImport("user32.dll")]
    public static extern bool CloseClipboard();
}
'@

$acquired = $false
$window = [ClipboardLock]::CreateWindowEx(0, 'STATIC', 'Clipboard contention fixture', 0, 0, 0, 0, 0, [IntPtr](-3), [IntPtr]::Zero, [IntPtr]::Zero, [IntPtr]::Zero)
if ($window -eq [IntPtr]::Zero) { throw 'Could not create the message-only clipboard owner.' }
for ($attempt = 0; $attempt -lt 100; $attempt++) {
    if ([ClipboardLock]::OpenClipboard($window)) {
        $acquired = $true
        break
    }
    Start-Sleep -Milliseconds 5
}
if (-not $acquired) { throw 'Could not acquire the clipboard for the contention test.' }
try {
    [Console]::Out.WriteLine('locked')
    [Console]::Out.Flush()
    [void][Console]::In.ReadLine()
    [Threading.Thread]::Sleep($Milliseconds)
} finally {
    [void][ClipboardLock]::CloseClipboard()
    [void][ClipboardLock]::DestroyWindow($window)
}
