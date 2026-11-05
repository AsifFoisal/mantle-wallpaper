$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$items = Get-StartApps | ForEach-Object {
  [pscustomobject]@{ name = [string]$_.Name; appsFolderId = [string]$_.AppID }
}
$out = $items | ConvertTo-Json -Depth 3 -Compress
if (@($items).Count -eq 1) { $out = "[" + $out + "]" }
if (-not $out) { $out = "[]" }
[Console]::Out.Write($out)
