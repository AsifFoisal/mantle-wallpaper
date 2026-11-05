$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$src = Join-Path $PSScriptRoot "registry.cs"
Add-Type -Path $src
$list = [MantleRegistry]::List()
$out = $list | ConvertTo-Json -Depth 3 -Compress
if (@($list).Count -eq 1) { $out = "[" + $out + "]" }
if (-not $out) { $out = "[]" }
[Console]::Out.Write($out)
