/**
 * Watchdog: mantem pontes + proxy web do posto sempre no ar (sem operador).
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_MS = 12000
const WEB_PORT = 39199
const PDV_URL = `http://127.0.0.1:${WEB_PORT}/pdv`

let postoChild = null
let starting = false
let openedBrowser = false

function log(msg) {
  console.log(`[posto-watchdog] ${new Date().toISOString()} ${msg}`)
}

function checkWebHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: WEB_PORT,
        path: '/__local/health',
        timeout: 2500,
      },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function openPdvOnce() {
  if (openedBrowser || process.platform !== 'win32') return
  openedBrowser = true
  log(`Abrindo PDV: ${PDV_URL}`)
  spawn('cmd', ['/c', 'start', '', PDV_URL], {
    windowsHide: true,
    stdio: 'ignore',
    detached: true,
  }).unref()
}

function startPosto() {
  if (starting) return
  starting = true
  log('Subindo pontes + proxy web...')
  if (postoChild && !postoChild.killed) {
    try {
      postoChild.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
  postoChild = spawn(process.execPath, [path.join(root, 'scripts', 'posto.mjs')], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  postoChild.stdout.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.log(line)
    }
  })
  postoChild.stderr.on('data', (buf) => {
    for (const line of String(buf).split(/\r?\n/)) {
      if (line.trim()) console.error(line)
    }
  })
  postoChild.on('exit', (code, signal) => {
    log(`posto encerrou (code=${code ?? '-'} signal=${signal ?? '-'})`)
    postoChild = null
    starting = false
  })
  setTimeout(() => {
    starting = false
  }, 10000)
}

async function tick() {
  const ok = await checkWebHealth()
  if (ok) {
    openPdvOnce()
    return
  }
  log('Proxy/pontes offline — reiniciando...')
  startPosto()
}

log(`Iniciado — monitora ${PDV_URL}`)
startPosto()
setInterval(() => {
  void tick()
}, CHECK_MS)

setInterval(() => {}, 1 << 30)

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
