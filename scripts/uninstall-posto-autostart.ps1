# Remove o autostart das pontes do posto.
# Uso: npm run posto:autostart:off

$ErrorActionPreference = 'Stop'
$taskName = 'ModuloInfo-PostoBridges'

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "Nenhuma tarefa '$taskName' encontrada."
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "OK: autostart '$taskName' removido."
