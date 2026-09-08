/**
 * Watchdog: mantém pontes + proxy web do posto sempre no ar.
 * Também escuta :39200 para a nuvem (Vercel) pedir “wake” / subir servidores.
 */
import { spawn } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_MS = 12000
const WEB_PORT = 39199
const WAKE_PORT = Number(process.env.POSTO_WAKE_PORT || 39200)
const PDV_URL = `http://127.0.0.1:${WEB_PORT}/pdv`
const ALLOWED_ORIGINS = [
  'https://modulo-e9xc.vercel.app',
  'http://127.0.0.1:39199',
  'http://localhost:39199',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]

let postoChild = null
let starting = false
let openedBrowser = false
let lastWakeAt = 0

function log(msg) {
  console.log(`[posto-watchdog] ${new Date().toISOString()} ${msg}`)
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || '')
  const allow =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.vercel.app') ||
    !origin
      ? origin || '*'
      : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
  }
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

function sendJson(req, res, status, body) {
  const headers = {
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
  }
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

/** Agente local: a Vercel chama /wake para subir as pontes se estiverem paradas. */
function startWakeServer() {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/'
    const method = req.method || 'GET'

    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }

    if (url === '/health' || url.startsWith('/health?')) {
      const webOk = await checkWebHealth()
      sendJson(req, res, 200, {
        ok: true,
        agent: 'posto-watchdog',
        wakePort: WAKE_PORT,
        webPort: WEB_PORT,
        webOnline: webOk,
        starting,
        lastWakeAt: lastWakeAt || null,
        pdv: PDV_URL,
      })
      return
    }

    if (url === '/wake' || url.startsWith('/wake?')) {
      lastWakeAt = Date.now()
      const webOk = await checkWebHealth()
      if (!webOk) {
        log('Wake recebido da nuvem — subindo posto…')
        startPosto()
      } else {
        log('Wake recebido — proxy já online')
      }
      sendJson(req, res, 200, {
        ok: true,
        started: !webOk,
        webOnline: webOk,
        pdv: PDV_URL,
        message: webOk
          ? 'Proxy já estava online'
          : 'Solicitado start das pontes locais',
      })
      return
    }

    sendJson(req, res, 404, { ok: false, error: 'not_found' })
  })

  server.listen(WAKE_PORT, '127.0.0.1', () => {
    log(`Agente wake em http://127.0.0.1:${WAKE_PORT}/wake`)
  })

  server.on('error', (err) => {
    log(`Falha ao abrir wake :${WAKE_PORT} — ${err.message}`)
  })
}

log(`Iniciado — monitora ${PDV_URL}`)
startWakeServer()
startPosto()
setInterval(() => {
  void tick()
}, CHECK_MS)

setInterval(() => {}, 1 << 30)

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
