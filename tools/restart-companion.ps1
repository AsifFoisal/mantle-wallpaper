Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'server\\dist\\index\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'Mantle Companion'
Start-Sleep -Seconds 3
$probe = Get-NetTCPConnection -LocalPort 7337 -State Listen -ErrorAction SilentlyContinue
if ($probe) { "companion up (pid $($probe[0].OwningProcess))" } else { "NOT LISTENING" }
