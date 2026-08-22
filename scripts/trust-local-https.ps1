# Gera (se preciso) e confia no certificado HTTPS local da ponte CBC.
# Assim o Chrome/Edge aceita https://127.0.0.1:39110 sem o operador clicar em Avancado.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/trust-local-https.ps1

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$certPem = Join-Path $root 'server\certs\local-cert.pem'
$certCer = Join-Path $root 'server\certs\local-cert.cer'
$friendly = 'ModuloInfoLocalBridge'

Write-Host '[trust-https] Garantindo certificado local...'
Push-Location $root
try {
  & node --input-type=module -e "import { loadOrCreateLocalCerts } from './server/local-certs.mjs'; await loadOrCreateLocalCerts(); console.log('ok')"
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar certificado local.' }
} finally {
  Pop-Location
}

if (-not (Test-Path $certPem)) {
  throw "Certificado nao encontrado: $certPem"
}

$importPath = if (Test-Path $certCer) { $certCer } else { $certPem }
$fileCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($importPath)
$thumb = $fileCert.Thumbprint

$existing = Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue |
  Where-Object { $_.Thumbprint -eq $thumb } |
  Select-Object -First 1

if ($existing) {
  Write-Host "[trust-https] Ja confiavel ($thumb)."
  exit 0
}

# Remove versoes antigas deste CN (evita lixo no store)
Get-ChildItem Cert:\CurrentUser\Root -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Subject -like "*CN=$friendly*" -or
    $_.FriendlyName -eq $friendly
  } |
  ForEach-Object {
    Write-Host "[trust-https] Removendo certificado antigo: $($_.Thumbprint)"
    Remove-Item $_.PSPath -Force -ErrorAction SilentlyContinue
  }

$imported = Import-Certificate -FilePath $importPath -CertStoreLocation Cert:\CurrentUser\Root
Write-Host "[trust-https] Importado de $importPath"
foreach ($c in @($imported)) {
  if ($c -and $c.PSPath) {
    try {
      $c.FriendlyName = $friendly
    } catch {
      # FriendlyName pode falhar em alguns stores; o trust ja foi aplicado
    }
  }
}

$check = Get-ChildItem Cert:\CurrentUser\Root |
  Where-Object { $_.Thumbprint -eq $thumb } |
  Select-Object -First 1

if (-not $check) {
  throw 'Certificado nao ficou no store CurrentUser\Root.'
}

Write-Host "[trust-https] OK - confianca instalada ($($check.Thumbprint))."
Write-Host '[trust-https] Chrome/Edge passam a aceitar https://127.0.0.1:39110 sem clique.'
