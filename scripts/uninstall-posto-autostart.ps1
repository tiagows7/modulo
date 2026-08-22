# Remove o autostart das pontes do posto.
# Uso: npm run posto:autostart:off

$ErrorActionPreference = 'Stop'
$taskName = 'ModuloInfo-PostoBridges'
$runName = 'ModuloInfoPosto'

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $runKey -Name $runName -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'posto-watchdog|posto\.mjs|cbc-bridge|tef-bridge|fiscal-bridge|smartpos-bridge' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "OK: autostart '$taskName' e Run '$runName' removidos; pontes encerradas."
