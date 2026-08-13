"use client";

import React, { StrictMode, useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ServerConnectionGuard } from './components/ServerConnectionGuard'
import { AlertProvider } from './context/AlertContext'
import { CartProvider } from './context/CartContext'
import { ConcentradorProvider } from './context/ConcentradorContext'
import { PreviewProvider } from './context/PreviewContext'

export default function BarraPdvRoot() {
  // Ensure the body/html take 100% height when PDV is mounted, similar to Vite's root
  useEffect(() => {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    return () => {
      // Revert styles when unmounted if necessary (optional)
      document.documentElement.style.height = '';
      document.body.style.height = '';
      document.body.style.margin = '';
    }
  }, [])

  return (
    <StrictMode>
      <HashRouter>
        <AlertProvider>
          <PreviewProvider>
            <ServerConnectionGuard>
              <CartProvider>
                <ConcentradorProvider>
                  <App />
                </ConcentradorProvider>
              </CartProvider>
            </ServerConnectionGuard>
          </PreviewProvider>
        </AlertProvider>
      </HashRouter>
    </StrictMode>
  )
}
