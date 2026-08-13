import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ServerConnectionGuard } from './components/ServerConnectionGuard'
import { AlertProvider } from './context/AlertContext'
import { CartProvider } from './context/CartContext'
import { ConcentradorProvider } from './context/ConcentradorContext'
import { PreviewProvider } from './context/PreviewContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
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
    </BrowserRouter>
  </StrictMode>,
)
