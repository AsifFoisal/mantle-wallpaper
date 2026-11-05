param([string]$InputJson = "")
$ErrorActionPreference = "SilentlyContinue"
if ($InputJson) { $p = $InputJson | ConvertFrom-Json } else { $p = [Console]::In.ReadToEnd() | ConvertFrom-Json }
$base = [string]$p.installLocation
$logo = [string]$p.logo
if (-not $base -or -not $logo) { [Console]::Out.Write('{"path":null}'); exit 0 }
$full = Join-Path $base ($logo -replace '/', '\')
$dir = Split-Path -Parent $full
$file = [System.IO.Path]::GetFileNameWithoutExtension($full)
$ext = [System.IO.Path]::GetExtension($full)
$best = $null
foreach ($c in @(Get-ChildItem -LiteralPath $dir -Filter "$file*")) {
  if ($c.Name -match '\.targetsize-(\d+)' -and $Matches[1] -ge 32) {
    $sz = [int]$Matches[1]
    if ($null -eq $best -or $sz -lt $best.sz) { $best = @{ sz = $sz; file = $c.FullName } }
  }
}
if ($null -eq $best) {
  foreach ($c in @(Get-ChildItem -LiteralPath $dir -Filter "$file*")) {
    if ($c.Name -match '\.scale-(\d+)') {
      $sz = [int]$Matches[1]
      if ($null -eq $best -or $sz -lt $best.sz) { $best = @{ sz = $sz; file = $c.FullName } }
    }
  }
}
if ($null -eq $best) {
  $any = Get-ChildItem -LiteralPath $dir -Filter "$file*" | Sort-Object Length -Descending | Select-Object -First 1
  if ($any) { $best = @{ sz = 0; file = $any.FullName } }
}
$path = if ($best) { [string]$best.file } else { $null }
[Console]::Out.Write((@{ path = $path } | ConvertTo-Json -Compress))
