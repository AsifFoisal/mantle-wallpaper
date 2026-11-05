param([Parameter(Mandatory=$true)][string]$Command, [string]$Argument = "0")
# Thin wrapper around Lively's command-line interface (Lively.exe --help).
$lively = @(
  (Join-Path $env:PROGRAMFILES "Lively Wallpaper\Lively.exe"),
  (Join-Path ${env:PROGRAMFILES(x86)} "Lively Wallpaper\Lively.exe"),
  "D:\Softwares\Lively Wallpaper\Lively.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $lively) { throw "Lively.exe not found" }
& $lively "-$Command" $Argument
