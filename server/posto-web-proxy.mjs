/**
 * Proxy local do PDV (HTTP) → Vercel + pontes locais.
 *
 * Assim o caixa abre http://127.0.0.1:39199/pdv (sem HTTPS/certificado).
 * O front chama /__local/cbc/* (same-origin) → ponte CBC em :39100.
 *
 * Uso: sobe via scripts/posto.mjs / posto-watchdog.
 */
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const PROXY_PORT = Number(process.env.POSTO_WEB_PORT || 39199)
const UPSTREAM = process.env.POSTO_UPSTREAM || 'https://modulo-e9xc.vercel.app'
const CBC_UPSTREAM = process.env.CBC_BRIDGE_HTTP || 'http://127.0.0.1:39100'

function proxyRequest(targetUrl, req, res, rewritePath) {
  const target = new URL(targetUrl)
  const path = rewritePath ?? req.url ?? '/'
  const isHttps = target.protocol === 'https:'
  const lib = isHttps ? https : http
  const headers = { ...req.headers, host: target.host }
  delete headers['accept-encoding']

  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path,
      method: req.method,
      headers,
      rejectUnauthorized: true,
      timeout: 60000,
    },
    (upRes) => {
      const outHeaders = { ...upRes.headers }
      // Evita o browser misturar cache do Vercel com o proxy local
      outHeaders['cache-control'] = 'no-store'
      res.writeHead(upRes.statusCode || 502, outHeaders)
      upRes.pipe(res)
    },
  )

  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ error: 'Falha no proxy local', detail: String(err.message || err) }))
  })
  upstream.on('timeout', () => {
    upstream.destroy()
  })

  req.pipe(upstream)
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'

  // Ponte CBC same-origin (sem mixed content / sem certificado)
  if (url === '/__local/cbc' || url.startsWith('/__local/cbc/')) {
    const rest = url.slice('/__local/cbc'.length) || '/'
    proxyRequest(CBC_UPSTREAM, req, res, rest.startsWith('/') ? rest : `/${rest}`)
    return
  }

  if (url === '/__local/health' || url.startsWith('/__local/health?')) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Cache-Control': 'no-store',
    })
    res.end(
      JSON.stringify({
        ok: true,
        proxy: 'posto-web',
        upstream: UPSTREAM,
        cbc: CBC_UPSTREAM,
        pdv: `http://127.0.0.1:${PROXY_PORT}/pdv`,
      }),
    )
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Access-Control-Request-Private-Network',
      'Access-Control-Allow-Private-Network': 'true',
    })
    res.end()
    return
  }

  proxyRequest(UPSTREAM, req, res, url)
})

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[Posto Web] http://127.0.0.1:${PROXY_PORT}/pdv`)
  console.log(`[Posto Web] Upstream: ${UPSTREAM}`)
  console.log(`[Posto Web] CBC local: ${CBC_UPSTREAM} via /__local/cbc`)
})
