"use client";

import React, { StrictMode, useCallback, useEffect, useState } from 'react'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ServerConnectionGuard } from './components/ServerConnectionGuard'
import { CaixaStatusGuard } from './components/CaixaStatusGuard'
import { AlertProvider } from './context/AlertContext'
import { CartProvider } from './context/CartContext'
import { CaixaStatusProvider } from './context/CaixaStatusContext'
import { ConcentradorProvider } from './context/ConcentradorContext'
import { PreviewProvider } from './context/PreviewContext'

const POSTO_PROXY_PORT = '39199'
const POSTO_PDV_URL = `http://127.0.0.1:${POSTO_PROXY_PORT}/pdv`
const POSTO_HEALTH_URL = `http://127.0.0.1:${POSTO_PROXY_PORT}/__local/health`

function isLocalPostoProxy() {
  const { hostname, port } = window.location
  return (
    (hostname === '127.0.0.1' || hostname === 'localhost') &&
    port === POSTO_PROXY_PORT
  )
}

/** PDV aberto na nuvem (Vercel) — no caixa deve ir para o proxy local. */
function isCloudPdvHost() {
  const host = window.location.hostname
  return host.endsWith('.vercel.app') || host === 'modulo-e9xc.vercel.app'
}

async function isPostoProxyOnline(): Promise<boolean> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(POSTO_HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      mode: 'cors',
    })
    if (!res.ok) return false
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return Boolean(body?.ok)
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

type BootState = 'loading' | 'ready' | 'proxy-offline'

export default function BarraPdvRoot() {
  const [boot, setBoot] = useState<BootState>('loading')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'
    document.body.style.margin = '0'
    return () => {
      document.documentElement.style.height = ''
      document.body.style.height = ''
      document.body.style.margin = ''
    }
  }, [])

  const goToLocalPdv = useCallback(() => {
    const dest = `${POSTO_PDV_URL}${window.location.search}${window.location.hash || '#/venda'}`
    window.location.replace(dest)
  }, [])

  const tryOpenLocalProxy = useCallback(async () => {
    setChecking(true)
    try {
      // Acorda o watchdog (se instalado) antes de ir ao proxy.
      try {
        await fetch('http://127.0.0.1:39200/wake', {
          method: 'POST',
          mode: 'cors',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      } catch {
        /* agente pode estar offline */
      }

      for (let i = 0; i < 12; i++) {
        const online = await isPostoProxyOnline()
        if (online) {
          goToLocalPdv()
          return
        }
        await new Promise((r) => window.setTimeout(r, 1500))
      }
      setBoot('proxy-offline')
    } finally {
      setChecking(false)
    }
  }, [goToLocalPdv])

  useEffect(() => {
    if (isLocalPostoProxy()) {
      setBoot('ready')
      return
    }
    if (isCloudPdvHost()) {
      void tryOpenLocalProxy()
      return
    }
    setBoot('ready')
  }, [tryOpenLocalProxy])

  if (boot === 'proxy-offline') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <p style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>
            Proxy do posto offline
          </p>
          <p style={{ fontSize: 14, opacity: 0.8, marginTop: 12, lineHeight: 1.5 }}>
            Faça login na Vercel; o PDV roda no PC do caixa. Instale uma vez o
            autostart (sobe pontes + agente wake na porta 39200):
          </p>
          <pre
            style={{
              margin: '16px 0',
              padding: '12px 14px',
              borderRadius: 8,
              background: '#1e293b',
              textAlign: 'left',
              fontSize: 13,
              overflow: 'auto',
            }}
          >
            npm run posto:autostart
          </pre>
          <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 16px' }}>
            Ou manualmente: npm run posto — depois {POSTO_PDV_URL}
          </p>
          <button
            type="button"
            onClick={() => void tryOpenLocalProxy()}
            disabled={checking}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              cursor: checking ? 'wait' : 'pointer',
            }}
          >
            {checking ? 'Verificando…' : 'Tentar novamente'}
          </button>
        </div>
      </div>
    )
  }

  if (boot !== 'ready') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ fontSize: 18, margin: 0 }}>Abrindo PDV do posto…</p>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
            {POSTO_PDV_URL}
          </p>
        </div>
      </div>
    )
  }

  return (
    <StrictMode>
      <HashRouter>
        <AlertProvider>
          <PreviewProvider>
            <ServerConnectionGuard>
              <CaixaStatusProvider>
                <CaixaStatusGuard>
                  <CartProvider>
                    <ConcentradorProvider>
                      <App />
                    </ConcentradorProvider>
                  </CartProvider>
                </CaixaStatusGuard>
              </CaixaStatusProvider>
            </ServerConnectionGuard>
          </PreviewProvider>
        </AlertProvider>
      </HashRouter>
    </StrictMode>
  )
}
