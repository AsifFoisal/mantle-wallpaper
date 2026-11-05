# Mantle — start the companion service with Windows
# Usage: npm run install:autostart
# Registers a hidden Task Scheduler task that starts server\dist\index.js at logon.
# Runs in the user's session so launched apps appear on the user's desktop.

$ErrorActionPreference = "Stop"
$TaskName = "Mantle Companion"
$root = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
}
if (-not $node) { throw "Node.js not found on PATH. Install Node.js 20+ first." }

$entry = Join-Path $root "server\dist\index.js"
if (-not (Test-Path $entry)) {
    Write-Host "Building companion..."
    Push-Location $root
    try { npm run build } finally { Pop-Location }
}
if (-not (Test-Path $entry)) { throw "Build output missing: $entry" }

# Node is a console app; launch it through a hidden windowless host so no
# black console flashes at logon.
$vbs = Join-Path $root "server\start-hidden.vbs"
@"
Set sh = CreateObject("WScript.Shell")
sh.Run """$node"" ""$entry""", 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
# Legacy pre-rename task.
Unregister-ScheduledTask -TaskName "Nexus Companion" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Mantle wallpaper companion service (127.0.0.1:7337)" | Out-Null

Write-Host "Installed scheduled task '$TaskName'." -ForegroundColor Green
Write-Host "Starting it now..."
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
# /api requires the token, so probe the port instead of the API.
$probe = Get-NetTCPConnection -LocalPort 7337 -State Listen -ErrorAction SilentlyContinue
if ($probe) {
    Write-Host "Companion online at http://127.0.0.1:7337/ (pid $($probe[0].OwningProcess))." -ForegroundColor Green
} else {
    Write-Host "Task started but port 7337 is not listening yet. Check again in a moment." -ForegroundColor Yellow
}
