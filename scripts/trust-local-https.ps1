# Prepara HTTPS opcional (sem dialog de CA) + politicas Chrome/Edge.
# O fluxo principal do caixa e HTTP local :39199 (sem certificado).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/trust-local-https.ps1

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pdvOrigins = @(
  'https://modulo-e9xc.vercel.app',
  'https://*.vercel.app'
)

Write-Host '[trust-https] Gerando certificados locais (opcional / fallback)...'
Push-Location $root
try {
  & node --input-type=module -e "import { loadOrCreateLocalCerts } from './server/local-certs.mjs'; await loadOrCreateLocalCerts(); console.log('ok')"
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar certificado local.' }
} finally {
  Pop-Location
}

function Set-BrowserLoopbackAllowList {
  param(
    [Parameter(Mandatory = $true)][string]$PolicyRoot,
    [Parameter(Mandatory = $true)][string[]]$Origins
  )
  $keys = @(
    'LocalNetworkAccessAllowedForUrls',
    'LoopbackNetworkAccessAllowedForUrls',
    'InsecurePrivateNetworkRequestsAllowedForUrls'
  )
  foreach ($name in $keys) {
    $path = Join-Path $PolicyRoot $name
    New-Item -Path $path -Force | Out-Null
    $i = 1
    foreach ($origin in $Origins) {
      New-ItemProperty -Path $path -Name "$i" -Value $origin -PropertyType String -Force | Out-Null
      $i += 1
    }
  }
}

Write-Host '[trust-https] Liberando Chrome/Edge (Local Network Access)...'
foreach ($pr in @(
  'HKCU:\SOFTWARE\Policies\Google\Chrome',
  'HKCU:\SOFTWARE\Policies\Microsoft\Edge'
)) {
  try {
    New-Item -Path $pr -Force | Out-Null
    Set-BrowserLoopbackAllowList -PolicyRoot $pr -Origins $pdvOrigins
    Write-Host "[trust-https] Politica OK: $pr"
  } catch {
    Write-Host "[trust-https] Aviso politica $pr : $($_.Exception.Message)"
  }
}

# Atalho na area de trabalho — operador so clica no PDV (ou o login ja abre)
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'PDV Posto.lnk'
$pdvUrl = 'http://127.0.0.1:39199/pdv'
try {
  $w = New-Object -ComObject WScript.Shell
  $sc = $w.CreateShortcut($shortcutPath)
  $sc.TargetPath = $pdvUrl
  $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
  $sc.Description = 'PDV Modulo Info (proxy local + concentrador)'
  $sc.Save()
  Write-Host "[trust-https] Atalho criado: $shortcutPath"
} catch {
  Write-Host "[trust-https] Aviso atalho: $($_.Exception.Message)"
}

Write-Host '[trust-https] OK - use http://127.0.0.1:39199/pdv (sem certificado).'
