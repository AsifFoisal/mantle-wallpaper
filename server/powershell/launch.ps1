# Launches a file through the shell (ShellExecute), so Windows applies its own
# security model: elevation manifests trigger the UAC prompt, .lnk shortcuts
# resolve normally. Payload via stdin: { file, args[], cwd } — every value comes
# from the trusted scan store, never from the request.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$payload = $null
try { $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch { }

if (-not $payload -or -not $payload.file) {
  [Console]::Out.Write((ConvertTo-Json @{ ok = $false; error = "no file" } -Compress))
  exit
}

$file = [string]$payload.file
$cwd = [string]$payload.cwd
# PS 5.1 joins -ArgumentList with spaces; quote items that contain spaces.
# Accumulate with += : @($null) would become a one-element null array.
$argList = @()
foreach ($a in @($payload.args)) {
  if ($a) {
    $item = [string]$a
    if ($item.Contains(" ")) { $item = '"' + $item + '"' }
    $argList += $item
  }
}

try {
  # Splat only non-empty parameters — PS 5.1 rejects -ArgumentList @().
  $params = @{ FilePath = $file; PassThru = $true }
  if (@($argList).Count -gt 0) { $params.ArgumentList = @($argList) }
  if ($cwd -and (Test-Path -LiteralPath $cwd)) { $params.WorkingDirectory = $cwd }
  $p = Start-Process @params
  [Console]::Out.Write((ConvertTo-Json @{ ok = $true; pid = $p.Id } -Compress))
} catch {
  [Console]::Out.Write((ConvertTo-Json @{ ok = $false; error = $_.Exception.Message } -Compress))
}
