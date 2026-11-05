# Mantle — install into Lively Wallpaper
# Usage: npm run install:lively
# Copies the Lively manifest + thumbnail into Lively's wallpaper library.
# Requires the companion to be running at http://127.0.0.1:7337 when the wallpaper is selected.
# -NoBuild skips the build step (useful while iterating with `npm run dev`).

param(
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$lib = Join-Path $env:LOCALAPPDATA "Lively Wallpaper\Library\wallpapers"
$target = Join-Path $lib "mantle.wallpaper"

if (-not (Test-Path $lib)) {
    Write-Host "Lively Wallpaper library not found at $lib" -ForegroundColor Yellow
    Write-Host "Install Lively Wallpaper first, launch it once, then re-run this script."
    exit 1
}

if (-not $NoBuild) {
    Write-Host "Building frontend + companion..."
    Push-Location $root
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed." }
    } finally {
        Pop-Location
    }
}

Write-Host "Copying wallpaper manifest to $target"
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item (Join-Path $root "lively\LivelyInfo.json") $target -Force
Copy-Item (Join-Path $root "lively\thumbnail.jpg") $target -Force

# Retire the pre-rename library entry once the new one is in place.
$legacy = Join-Path $lib "nexus.wallpaper"
if (Test-Path $legacy) {
    Remove-Item $legacy -Recurse -Force
    Write-Host "Removed legacy library entry nexus.wallpaper."
}

# Lively must have web input forwarded so clicks reach the wallpaper.
$settingsPath = Join-Path $env:LOCALAPPDATA "Lively Wallpaper\Settings.json"
if (Test-Path $settingsPath) {
    try {
        $json = Get-Content $settingsPath -Raw | ConvertFrom-Json
        if ($json.InputForward -eq 1 -and $json.MouseInputMovAlways -eq $true) {
            Write-Host "Lively mouse input: already enabled." -ForegroundColor Green
        } else {
            $json.InputForward = 1
            $json.MouseInputMovAlways = $true
            $json | ConvertTo-Json -Depth 20 | Set-Content $settingsPath -Encoding UTF8
            Write-Host "Enabled mouse input in Lively settings. Restart Lively to apply." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Could not update Lively settings automatically: $_" -ForegroundColor Yellow
    }
}

# Is the companion up?
$probe = Get-NetTCPConnection -LocalPort 7337 -State Listen -ErrorAction SilentlyContinue
if ($probe) {
    Write-Host "Companion service: online (pid $($probe[0].OwningProcess))." -ForegroundColor Green
} else {
    Write-Host "Companion not running on 127.0.0.1:7337. Start it with 'npm start' or install autostart with 'npm run install:autostart'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Open Lively, find 'Mantle' in the library and set it as your wallpaper." -ForegroundColor Cyan
Write-Host "If the wallpaper is not clickable, open Lively Settings and ensure mouse input is enabled (this script sets it)."
