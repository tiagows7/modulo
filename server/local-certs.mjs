/**
 * Certificado local autoassinado para pontes HTTPS (Vercel HTTPS → localhost).
 * CN único para o Windows confiar automaticamente (scripts/trust-local-https.ps1).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { X509Certificate } from 'node:crypto'
import selfsigned from 'selfsigned'

const CERT_CN = 'ModuloInfoLocalBridge'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const certDir = path.join(root, 'server', 'certs')
const keyPath = path.join(certDir, 'local-key.pem')
const certPath = path.join(certDir, 'local-cert.pem')

function certHasExpectedCn(pem) {
  try {
    const x509 = new X509Certificate(pem)
    return x509.subject.includes(`CN=${CERT_CN}`)
  } catch {
    return false
  }
}

export async function loadOrCreateLocalCerts() {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const cert = fs.readFileSync(certPath)
    if (certHasExpectedCn(cert)) {
      const cerPath = path.join(certDir, 'local-cert.cer')
      if (!fs.existsSync(cerPath)) {
        fs.writeFileSync(cerPath, new X509Certificate(cert).raw)
      }
      return {
        key: fs.readFileSync(keyPath),
        cert,
      }
    }
    // CN antigo (ex.: localhost) — regenera para o trust automático funcionar
  }

  fs.mkdirSync(certDir, { recursive: true })
  const attrs = [{ name: 'commonName', value: CERT_CN }]
  const pems = await selfsigned.generate(attrs, {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  })

  fs.writeFileSync(keyPath, pems.private, 'utf8')
  fs.writeFileSync(certPath, pems.cert, 'utf8')
  // DER (.cer) — Import-Certificate no Windows é mais estável com este formato
  const der = new X509Certificate(pems.cert).raw
  fs.writeFileSync(path.join(certDir, 'local-cert.cer'), der)
  return { key: pems.private, cert: pems.cert }
}

export { CERT_CN }
