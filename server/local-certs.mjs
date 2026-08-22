/**
 * Certificado local autoassinado para pontes HTTPS (Vercel HTTPS → localhost).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import selfsigned from 'selfsigned'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const certDir = path.join(root, 'server', 'certs')
const keyPath = path.join(certDir, 'local-key.pem')
const certPath = path.join(certDir, 'local-cert.pem')

export async function loadOrCreateLocalCerts() {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  }

  fs.mkdirSync(certDir, { recursive: true })
  const attrs = [{ name: 'commonName', value: 'localhost' }]
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
  return { key: pems.private, cert: pems.cert }
}
