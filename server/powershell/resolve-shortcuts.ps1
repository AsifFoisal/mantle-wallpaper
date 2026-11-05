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

$results = @()
$shell = New-Object -ComObject WScript.Shell -ErrorAction SilentlyContinue

foreach ($item in @($payload.items)) {
  $path = [string]$item.path
  $entry = [ordered]@{
    name         = [string]$item.name
    shortcutPath = $path
    target       = $null
    arguments    = $null
    workingDirectory = $null
    targetType   = $null
    source       = [string]$item.source
    exists       = $false
  }
  if ($shell -and (Test-Path -LiteralPath $path)) {
    try {
      $lnk = $shell.CreateShortcut($path)
      $target = [string]$lnk.TargetPath
      $entry.arguments = [string]$lnk.Arguments
      $entry.workingDirectory = [string]$lnk.WorkingDirectory
      $entry.target = $target
      if ($target) {
        $ext = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
        $entry.targetType = $ext
        # Resolve env-style paths and package targets (UWP store shortcuts).
        if ($target -match '^Microsoft\.Windows\.|applicationframehost|GameBar') {
          $entry.exists = $true
        } else {
          $entry.exists = Test-Path -LiteralPath $target
        }
      }
    } catch {
      $entry.targetType = "broken"
    }
  } elseif (Test-Path -LiteralPath $path) {
    $entry.exists = $true
  }
  $results += [pscustomobject]$entry
}

if ($shell) {
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
}

$out = $results | ConvertTo-Json -Depth 4 -Compress
if ($results.Count -eq 1) { $out = "[" + $out + "]" }
if (-not $out) { $out = "[]" }
[Console]::Out.Write($out)
