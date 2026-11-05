# Enumerates visible top-level windows (taskbar list) and minimizes/restores
# them by hwnd. Payload via stdin: {"action":"minimize"|"restore","hwnd":n}
# or {} to list. Outputs JSON on stdout, "true"/"false" for actions.
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace MantleWin
{
  public class WindowRec
  {
    public long hwnd;
    public long pid;
    public string title;
    public string exe;
    public bool minimized;
  }

  public class WindowManager
  {
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder t, int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int idx);
    [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr h, ref PLACEMENT p);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder name, ref uint size);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int l; public int t; public int r; public int b; }
    [StructLayout(LayoutKind.Sequential)] struct PLACEMENT { public uint length; public uint flags; public uint showCmd; public POINT min; public POINT max; public RECT normal; }

    static string ExeOf(uint pid)
    {
      IntPtr h = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
      if (h == IntPtr.Zero) return "";
      try
      {
        var sb = new StringBuilder(1024);
        uint size = 1024;
        if (QueryFullProcessImageName(h, 0, sb, ref size))
        {
          var p = sb.ToString();
          int i = p.LastIndexOf('\\');
          return i >= 0 ? p.Substring(i + 1) : p;
        }
        return "";
      }
      finally { CloseHandle(h); }
    }

    public static List<WindowRec> List()
    {
      var list = new List<WindowRec>();
      EnumWindows((h, l) =>
      {
        try
        {
          if (!IsWindowVisible(h)) return true;
          int len = GetWindowTextLength(h);
          if (len == 0) return true;
          if ((GetWindowLong(h, -20) & 0x80) != 0) return true; // WS_EX_TOOLWINDOW
          int cloaked;
          DwmGetWindowAttribute(h, 14, out cloaked, 4); // DWMWA_CLOAKED
          if (cloaked != 0) return true;
          var sb = new StringBuilder(len + 1);
          GetWindowText(h, sb, len + 1);
          var title = sb.ToString();
          if (string.IsNullOrWhiteSpace(title)) return true;
          uint pid;
          GetWindowThreadProcessId(h, out pid);
          if (pid == 0) return true;
          var wp = new PLACEMENT();
          wp.length = (uint)Marshal.SizeOf(typeof(PLACEMENT));
          GetWindowPlacement(h, ref wp);
          list.Add(new WindowRec { hwnd = h.ToInt64(), pid = pid, title = title, exe = ExeOf(pid), minimized = wp.showCmd == 2 });
        }
        catch { }
        return true;
      }, IntPtr.Zero);
      return list;
    }

    public static bool Act(long hwnd, string action)
    {
      IntPtr h = new IntPtr(hwnd);
      if (action == "minimize") return ShowWindow(h, 6);   // SW_MINIMIZE
      if (action == "restore") { bool r = ShowWindow(h, 9); if (r) SetForegroundWindow(h); return r; } // SW_RESTORE
      return false;
    }
  }
}
'@

# Compile the helper once into a DLL beside this script; later polls skip the
# C# compiler entirely (a fresh powershell.exe spawn stays ~sub-second).
$dll = Join-Path $PSScriptRoot "MantleWin.Windows.dll"
if (-not ("MantleWin.WindowManager" -as [type])) {
  try {
    if (-not (Test-Path -LiteralPath $dll)) {
      Add-Type -TypeDefinition $src -OutputAssembly $dll
    }
    Add-Type -Path $dll | Out-Null
    if (-not ("MantleWin.WindowManager" -as [type])) { throw "type not loaded" }
  } catch {
    Add-Type -TypeDefinition $src
  }
}

$payload = $null
try {
  $raw = [Console]::In.ReadToEnd()
  if ($raw) { $payload = $raw | ConvertFrom-Json }
} catch { }

if ($payload -and $payload.action -and $payload.hwnd) {
  $ok = [MantleWin.WindowManager]::Act([long]$payload.hwnd, [string]$payload.action)
  if ($ok) { [Console]::Out.Write("true") } else { [Console]::Out.Write("false") }
  exit
}

$items = @()
foreach ($w in [MantleWin.WindowManager]::List()) {
  $items += [pscustomobject]@{
    hwnd      = $w.hwnd
    pid       = $w.pid
    title     = $w.title
    exe       = $w.exe
    minimized = $w.minimized
  }
}
$out = $items | ConvertTo-Json -Depth 2 -Compress
if (@($items).Count -eq 1) { $out = "[" + $out + "]" }
if (-not $out) { $out = "[]" }
[Console]::Out.Write($out)
