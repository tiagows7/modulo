"use client";

import React, { StrictMode, useEffect, useState } from 'react'
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

export default function BarraPdvRoot() {
  const [ready, setReady] = useState(false)

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

  useEffect(() => {
    if (isLocalPostoProxy()) {
      setReady(true)
      return
    }
    if (isCloudPdvHost()) {
      const dest = `http://127.0.0.1:${POSTO_PROXY_PORT}/pdv${window.location.search}${window.location.hash}`
      window.location.replace(dest)
      return
    }
    setReady(true)
  }, [])

  if (!ready) {
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
            http://127.0.0.1:{POSTO_PROXY_PORT}/pdv
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
