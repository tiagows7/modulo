/**
 * Gateway do PDV na porta 8765.
 *
 * Proxy para Next (:8766). Sem health-check HEAD em toda request
 * (isso sobrecarregava o Next e fazia o login cair na splash /?#).
 *
 * Uso:
 *   npm run gateway
 *   npx next dev -p 8766
 */
import http from 'node:http'

const GATEWAY_PORT = Number(process.env.PDV_GATEWAY_PORT || 8765)
const VITE_PORT = Number(process.env.PDV_VITE_PORT || 8766)
const VITE_HOST = '127.0.0.1'
const STARTUP_ATTEMPTS = 8

/** Cache curto só para /__pdv_health (splash). */
let healthCache = { ok: false, checkedAt: 0 }
const HEALTH_TTL_MS = 2000

function checkVite(timeoutMs = 2500) {
  const now = Date.now()
  if (now - healthCache.checkedAt < HEALTH_TTL_MS) {
    return Promise.resolve(healthCache.ok)
  }
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: VITE_HOST,
        port: VITE_PORT,
        path: '/',
        method: 'HEAD',
        timeout: timeoutMs,
      },
      (res) => {
        res.resume()
        healthCache = { ok: true, checkedAt: Date.now() }
        resolve(true)
      },
    )
    req.on('error', () => {
      healthCache = { ok: false, checkedAt: Date.now() }
      resolve(false)
    })
    req.on('timeout', () => {
      req.destroy()
      healthCache = { ok: false, checkedAt: Date.now() }
      resolve(false)
    })
    req.end()
  })
}

function pathOnly(url) {
  return String(url || '/').split('?')[0]
}

/** Splash só para navegação de documento HTML — nunca para API/_next. */
function shouldShowSplash(req) {
  const path = pathOnly(req.url)
  if (path.startsWith('/api/')) return false
  if (path.startsWith('/_next/')) return false
  if (path.startsWith('/__pdv_health')) return false
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const accept = String(req.headers.accept || '')
  if (path.includes('.')) {
    if (/\.(js|mjs|css|map|png|jpg|jpeg|svg|ico|webp|woff2?|ttf|json|webmanifest)$/i.test(path)) {
      return false
    }
  }
  return accept.includes('text/html') || accept === '' || accept.includes('*/*')
}

function splashHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PDV Posto — Conectando</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Outfit, Segoe UI, system-ui, sans-serif;
      background: #0f1c30;
      color: #eef3fb;
      padding: 24px;
    }
    .card {
      width: min(460px, 100%);
      padding: 36px 28px 28px;
      border-radius: 18px;
      background: #16263d;
      border: 1px solid rgba(255,255,255,0.12);
      text-align: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
    }
    .spinner {
      width: 48px; height: 48px; margin: 0 auto 18px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #2f80ed;
      animation: spin 0.8s linear infinite;
    }
    .icon {
      width: 56px; height: 56px; margin: 0 auto 16px;
      border-radius: 50%; display: grid; place-items: center;
      background: rgba(239,90,90,0.15);
      border: 1px solid rgba(239,90,90,0.4);
      color: #ff8a80; font-size: 1.6rem; font-weight: 700;
    }
    h1 { margin: 0 0 10px; font-size: 1.45rem; }
    p { margin: 0 0 22px; color: #b7c3d6; line-height: 1.45; }
    button {
      min-width: 180px; border: 0; border-radius: 10px;
      padding: 12px 18px; font-size: 1rem; font-weight: 600;
      background: #2f80ed; color: #fff; cursor: pointer;
    }
    button:disabled { opacity: 0.65; cursor: wait; }
    .hidden { display: none !important; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card" id="connecting">
    <div class="spinner" aria-hidden="true"></div>
    <h1>Conectando ao servidor…</h1>
    <p id="connecting-msg">Aguarde enquanto o PDV verifica a comunicação com o servidor.</p>
  </div>
  <div class="card hidden" id="offline">
    <div class="icon" aria-hidden="true">⚠</div>
    <h1>Sem conexão com o servidor</h1>
    <p>Não foi possível acessar o servidor do PDV. Verifique se ele está ligado e tente novamente.</p>
    <button type="button" id="retry">Tentar novamente</button>
  </div>
  <script>
    const ATTEMPTS = ${STARTUP_ATTEMPTS};
    const GAP_MS = 1500;
    const connecting = document.getElementById('connecting');
    const offline = document.getElementById('offline');
    const msg = document.getElementById('connecting-msg');
    const retry = document.getElementById('retry');

    async function health() {
      try {
        const res = await fetch('/__pdv_health?t=' + Date.now(), { cache: 'no-store' });
        return res.ok;
      } catch {
        return false;
      }
    }

    function showConnecting() {
      offline.classList.add('hidden');
      connecting.classList.remove('hidden');
    }
    function showOffline() {
      connecting.classList.add('hidden');
      offline.classList.remove('hidden');
    }

    async function connectLoop() {
      showConnecting();
      for (let i = 1; i <= ATTEMPTS; i++) {
        msg.innerHTML = 'Aguarde enquanto o PDV verifica a comunicação com o servidor.<br>Tentativa ' + i + ' de ' + ATTEMPTS;
        if (await health()) {
          location.reload();
          return;
        }
        if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, GAP_MS));
      }
      showOffline();
    }

    retry.addEventListener('click', () => {
      retry.disabled = true;
      connectLoop().finally(() => { retry.disabled = false; });
    });

    connectLoop();
  </script>
</body>
</html>`
}

function sendSplash(res) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(splashHtml())
}

function proxyToNext(req, res) {
  const headers = { ...req.headers, host: `${VITE_HOST}:${VITE_PORT}` }
  const proxyReq = http.request(
    {
      hostname: VITE_HOST,
      port: VITE_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      healthCache = { ok: true, checkedAt: Date.now() }
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', () => {
    healthCache = { ok: false, checkedAt: Date.now() }
    if (shouldShowSplash(req)) {
      sendSplash(res)
      return
    }
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'Next offline' }))
  })
  req.pipe(proxyReq)
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'

  if (pathOnly(url).startsWith('/__pdv_health')) {
    const ok = await checkVite()
    res.writeHead(ok ? 200 : 503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(JSON.stringify({ ok, vite: `http://${VITE_HOST}:${VITE_PORT}` }))
    return
  }

  // Sempre tenta proxy (sem HEAD prévio). Splash só se a conexão falhar.
  proxyToNext(req, res)
})

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log(`[PDV Gateway] http://localhost:${GATEWAY_PORT}`)
  console.log(`[PDV Gateway] Proxy → http://${VITE_HOST}:${VITE_PORT}`)
  console.log('[PDV Gateway] Offline: tela "Conectando ao servidor…"')
})
