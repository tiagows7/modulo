# Instala watchdog + proxy local do PDV. Operador nao roda npm no dia a dia.
# Uso: npm run posto:autostart

$ErrorActionPreference = 'Stop'
$taskName = 'ModuloInfo-PostoBridges'
$runName = 'ModuloInfoPosto'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$vbs = Join-Path $PSScriptRoot 'posto-watchdog-hidden.vbs'
$trustScript = Join-Path $PSScriptRoot 'trust-local-https.ps1'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$pdvUrl = 'http://127.0.0.1:39199/pdv'

if (-not (Test-Path $vbs)) {
  throw "Arquivo nao encontrado: $vbs"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js nao encontrado no PATH. Instale o Node e tente novamente."
}

Write-Host ''
Write-Host '=== 1/3 Atalho + politicas do navegador ==='
& powershell -NoProfile -ExecutionPolicy Bypass -File $trustScript
if ($LASTEXITCODE -ne 0) { throw 'Falha na preparacao local.' }

Write-Host ''
Write-Host '=== 2/3 Autostart no login (tarefa) ==='
$action = New-ScheduledTaskAction -Execute $wscript -Argument "`"$vbs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Watchdog Modulo Info: pontes + proxy PDV local (39199).' | Out-Null

Write-Host ''
Write-Host '=== 3/3 Run key + start agora ==='
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-ItemProperty -Path $runKey -Name $runName -Value "`"$wscript`" `"$vbs`"" -PropertyType String -Force | Out-Null

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'posto-watchdog|posto\.mjs|cbc-bridge|tef-bridge|fiscal-bridge|smartpos-bridge|posto-web-proxy' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'OK: posto automatico instalado.'
Write-Host "- No login: sobe pontes + proxy e abre o PDV sozinho"
Write-Host "- URL do caixa: $pdvUrl"
Write-Host '- Atalho na area de trabalho: PDV Posto'
Write-Host ''
Write-Host "NAO use o Vercel direto no caixa - use $pdvUrl"
Write-Host 'Remover: npm run posto:autostart:off'
Write-Host ''
