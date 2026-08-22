/**
 * Sobe as pontes locais do posto (CBC, TEF, Fiscal, SmartPOS).
 * Uso: npm run posto
 *
 * O site pode ficar no Vercel; estas pontes precisam rodar no PC
 * da rede local para falar com concentrador / pinpad / impressora.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const services = [
  { name: 'CBC', file: 'server/cbc-bridge.mjs', url: 'http://127.0.0.1:39100' },
  { name: 'TEF', file: 'server/tef-bridge.mjs', url: 'http://127.0.0.1:39101' },
  { name: 'Fiscal', file: 'server/fiscal-bridge.mjs', url: 'http://127.0.0.1:39102' },
  { name: 'SmartPOS', file: 'server/smartpos-bridge.mjs', url: 'http://127.0.0.1:39103' },
  { name: 'Web', file: 'server/posto-web-proxy.mjs', url: 'http://127.0.0.1:39199/pdv' },
]

const children = []

/** Confia no certificado HTTPS local no Windows (sem clique no navegador). */
function ensureLocalHttpsTrust() {
  if (process.platform !== 'win32') return
  const script = path.join(root, 'scripts', 'trust-local-https.ps1')
  // Nao bloqueia a subida das pontes; roda em paralelo.
  const child = spawn(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  child.stdout.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.log(line)
    }
  })
  child.stderr.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.warn(line)
    }
  })
  child.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`[posto] Aviso: trust HTTPS encerrou com codigo ${code}`)
    }
  })
}

function start(service) {
  const child = spawn(process.execPath, [path.join(root, service.file)], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const prefix = `[${service.name}]`
  child.stdout.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.log(`${prefix} ${line}`)
    }
  })
  child.stderr.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.error(`${prefix} ${line}`)
    }
  })
  child.on('exit', (code, signal) => {
    console.log(`${prefix} encerrou (code=${code ?? '-'} signal=${signal ?? '-'})`)
  })

  children.push(child)
  console.log(`${prefix} iniciando → ${service.url}`)
}

console.log('')
console.log('=== Módulo Info · pontes do posto ===')
console.log('Site (nuvem): https://modulo-e9xc.vercel.app')
console.log('Concentrador CBC: use CBC_HOST / CBC_PORT se precisar (padrão 192.168.1.150:1771)')
console.log('Ctrl+C para parar todas as pontes.')
console.log('')

for (const service of services) start(service)
ensureLocalHttpsTrust()

function shutdown() {
  console.log('\nEncerrando pontes…')
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(0), 400)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
