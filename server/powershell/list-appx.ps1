$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$items = @()
Get-AppxPackage | ForEach-Object {
  $pkg = $_
  $manifest = Join-Path $pkg.InstallLocation "AppxManifest.xml"
  if (-not (Test-Path -LiteralPath $manifest)) { return }
  try {
    [xml]$xml = Get-Content -LiteralPath $manifest -Raw
  } catch { return }
  $app = $xml.Package.Applications.Application | Select-Object -First 1
  if (-not $app) { return }
  $logo = $null
  if ($app.VisualElements -and $app.VisualElements.Square44x44Logo) { $logo = [string]$app.VisualElements.Square44x44Logo }
  elseif ($app.VisualElements -and $app.VisualElements.Square150x150Logo) { $logo = [string]$app.VisualElements.Square150x150Logo }
  $items += [pscustomobject]@{
    packageFamilyName = [string]$pkg.PackageFamilyName
    applicationId     = [string]$app.Id
    displayName       = [string]$app.VisualElements.DisplayName
    installLocation   = [string]$pkg.InstallLocation
    logo              = $logo
  }
}
$out = $items | ConvertTo-Json -Depth 3 -Compress
if (@($items).Count -eq 1) { $out = "[" + $out + "]" }
if (-not $out) { $out = "[]" }
[Console]::Out.Write($out)
