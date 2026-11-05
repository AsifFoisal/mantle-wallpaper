$t = Get-ScheduledTask -TaskName 'Mantle Companion'
$i = $t | Get-ScheduledTaskInfo
"TaskState:   $($t.State)"
"LastRunTime: $($i.LastRunTime)"
"LastResult:  $($i.LastTaskResult)"
""
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'server' } |
  ForEach-Object { "pid $($_.ProcessId): $($_.CommandLine.Substring(0, [Math]::Min(130, $_.CommandLine.Length)))" }
