/**
 * CA local + certificado de servidor para pontes HTTPS.
 * O Windows confia na CA (Root); o Chrome/Edge aceitam https://127.0.0.1 sem clique.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { X509Certificate } from 'node:crypto'
import forge from 'node-forge'

const CA_CN = 'ModuloInfoLocalCA'
const SERVER_CN = 'ModuloInfoLocalBridge'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const certDir = path.join(root, 'server', 'certs')
const caKeyPath = path.join(certDir, 'ca-key.pem')
const caCertPath = path.join(certDir, 'ca-cert.pem')
const caCerPath = path.join(certDir, 'ca-cert.cer')
const keyPath = path.join(certDir, 'local-key.pem')
const certPath = path.join(certDir, 'local-cert.pem')
const cerPath = path.join(certDir, 'local-cert.cer')

function yearsFromNow(years) {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return d
}

function ensureDir() {
  fs.mkdirSync(certDir, { recursive: true })
}

function writeDer(pemCert, outPath) {
  fs.writeFileSync(outPath, new X509Certificate(pemCert).raw)
}

function loadExistingServerPair() {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath) || !fs.existsSync(caCertPath)) {
    return null
  }
  try {
    const certPem = fs.readFileSync(certPath, 'utf8')
    const caPem = fs.readFileSync(caCertPath, 'utf8')
    const x509 = new X509Certificate(certPem)
    const ca = new X509Certificate(caPem)
    if (!x509.subject.includes(`CN=${SERVER_CN}`)) return null
    if (!ca.subject.includes(`CN=${CA_CN}`)) return null
    if (!fs.existsSync(caCerPath)) writeDer(caPem, caCerPath)
    if (!fs.existsSync(cerPath)) writeDer(certPem, cerPath)
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      caCertPath: caCerPath,
      caPemPath: caCertPath,
    }
  } catch {
    return null
  }
}

function createCaAndServer() {
  ensureDir()

  const caKeys = forge.pki.rsa.generateKeyPair(2048)
  const caCert = forge.pki.createCertificate()
  caCert.publicKey = caKeys.publicKey
  caCert.serialNumber = '01'
  caCert.validity.notBefore = new Date()
  caCert.validity.notAfter = yearsFromNow(10)
  caCert.setSubject([{ name: 'commonName', value: CA_CN }])
  caCert.setIssuer([{ name: 'commonName', value: CA_CN }])
  caCert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ])
  caCert.sign(caKeys.privateKey, forge.md.sha256.create())

  const serverKeys = forge.pki.rsa.generateKeyPair(2048)
  const serverCert = forge.pki.createCertificate()
  serverCert.publicKey = serverKeys.publicKey
  serverCert.serialNumber = '02'
  serverCert.validity.notBefore = new Date()
  serverCert.validity.notAfter = yearsFromNow(10)
  serverCert.setSubject([{ name: 'commonName', value: SERVER_CN }])
  serverCert.setIssuer(caCert.subject.attributes)
  serverCert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: true },
  ])
  serverCert.sign(caKeys.privateKey, forge.md.sha256.create())

  const caPem = forge.pki.certificateToPem(caCert)
  const caKeyPem = forge.pki.privateKeyToPem(caKeys.privateKey)
  const serverPem = forge.pki.certificateToPem(serverCert)
  const serverKeyPem = forge.pki.privateKeyToPem(serverKeys.privateKey)

  fs.writeFileSync(caKeyPath, caKeyPem, 'utf8')
  fs.writeFileSync(caCertPath, caPem, 'utf8')
  fs.writeFileSync(keyPath, serverKeyPem, 'utf8')
  fs.writeFileSync(certPath, serverPem, 'utf8')
  writeDer(caPem, caCerPath)
  writeDer(serverPem, cerPath)

  return {
    key: serverKeyPem,
    cert: serverPem,
    caCertPath: caCerPath,
    caPemPath: caCertPath,
  }
}

/** @returns {Promise<{ key: Buffer|string, cert: Buffer|string, caCertPath: string, caPemPath: string }>} */
export async function loadOrCreateLocalCerts() {
  const existing = loadExistingServerPair()
  if (existing) return existing
  return createCaAndServer()
}

export { CA_CN, SERVER_CN, caCerPath, caCertPath }
