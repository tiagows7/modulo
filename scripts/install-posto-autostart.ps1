# Instala as pontes do posto para iniciarem automaticamente no login do Windows.
# Uso (PowerShell, na pasta do projeto):
#   npm run posto:autostart
#   ou: powershell -ExecutionPolicy Bypass -File scripts/install-posto-autostart.ps1

$ErrorActionPreference = 'Stop'
$taskName = 'ModuloInfo-PostoBridges'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$vbs = Join-Path $PSScriptRoot 'posto-hidden.vbs'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

if (-not (Test-Path $vbs)) {
  throw "Arquivo nao encontrado: $vbs"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js nao encontrado no PATH. Instale o Node e tente novamente."
}

$action = New-ScheduledTaskAction -Execute $wscript -Argument "`"$vbs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Sobe pontes locais CBC/TEF/Fiscal/SmartPOS do Modulo Info no login.' | Out-Null

# Inicia agora (nao espera o proximo login)
Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "OK: tarefa '$taskName' instalada."
Write-Host "As pontes sobem automaticamente ao logar neste Windows."
Write-Host "Ja foi disparada uma vez agora."
Write-Host ""
Write-Host "Abra o PDV: https://modulo-e9xc.vercel.app/pdv"
Write-Host "Remover depois: npm run posto:autostart:off"
Write-Host ""
