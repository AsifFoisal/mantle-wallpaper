param(
  [string]$InputJson = ""
)
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

if ($InputJson) {
  $payload = $InputJson | ConvertFrom-Json
} else {
  $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
}

$target = [string]$payload.target
if (-not $target) { [Console]::Out.Write('{"ok":false,"sizes":[]}'); exit 0 }

Add-Type -AssemblyName System.Drawing
$outDir = [string]$payload.outDir
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$sizes = @(256, 128, 64, 32)

function Convert-ToPng([System.Drawing.Image]$img, [string]$dir) {
  $wrote = @()
  $max = [Math]::Max($img.Width, $img.Height)
  foreach ($s in $sizes) {
    try {
      $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)
      $dw = [int][Math]::Round($s * ($img.Width / $max))
      $dh = [int][Math]::Round($s * ($img.Height / $max))
      $g.DrawImage($img, [int](($s - $dw) / 2), [int](($s - $dh) / 2), $dw, $dh)
      $g.Dispose()
      $bmp.Save((Join-Path $dir "$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      $wrote += $s
    } catch { }
  }
  return $wrote
}

$result = @()

if ($target -match '\.(png|bmp|jpg|jpeg|ico)$') {
  # Asset file (packaged app logo): draw it directly.
  try {
    $img = [System.Drawing.Image]::FromFile($target)
    $result = @(Convert-ToPng $img $outDir)
    $img.Dispose()
  } catch { }
}

if ($result.Count -eq 0) {
  # Executable icon through the shell image list.
  try {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class MantleIcon {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct SHFILEINFO { public IntPtr hIcon; public int iIcon; public uint dwAttributes; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName; }
  [DllImport("shell32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr SHGetFileInfo(string path, uint attrs, ref SHFILEINFO info, uint cb, uint flags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);
  public const uint SHGFI_ICON = 0x100;
  public const uint SHGFI_LARGEICON = 0x0;
}
"@
    $info = New-Object MantleIcon+SHFILEINFO
    $ok = [MantleIcon]::SHGetFileInfo($target, 0, [ref]$info, [System.Runtime.InteropServices.Marshal]::SizeOf($info), [MantleIcon]::SHGFI_ICON -bor [MantleIcon]::SHGFI_LARGEICON)
    if ($ok -ne [IntPtr]::Zero -and $info.hIcon -ne [IntPtr]::Zero) {
      $icon = [System.Drawing.Icon]::FromHandle($info.hIcon)
      $img = $icon.ToBitmap()
      $result = @(Convert-ToPng $img $outDir)
      $img.Dispose()
      $icon.Dispose()
      [void][MantleIcon]::DestroyIcon($info.hIcon)
    }
  } catch { }
}

if ($result.Count -eq 0) {
  try {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($target)
    if ($icon) {
      $img = $icon.ToBitmap()
      $result = @(Convert-ToPng $img $outDir)
      $img.Dispose()
      $icon.Dispose()
    }
  } catch { }
}

[Console]::Out.Write((@{ ok = ($result.Count -gt 0); sizes = @($result) } | ConvertTo-Json -Compress))
