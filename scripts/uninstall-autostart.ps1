# Removes the Mantle companion autostart task.
$ErrorActionPreference = "SilentlyContinue"
$TaskName = "Mantle Companion"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
# Legacy pre-rename task.
Unregister-ScheduledTask -TaskName "Nexus Companion" -Confirm:$false
$proc = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*Mantle Wallpaper*server*dist*index.js*" -or $_.CommandLine -like "*Wallpaper\server\dist\index.js*" }
foreach ($p in $proc) { Stop-Process -Id $p.ProcessId -Force }
Write-Host "Removed '$TaskName' and stopped the companion if it was running."
