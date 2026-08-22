import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { operators, station } from '../data/mock'
import { useConcentrador } from '../context/ConcentradorContext'
import { startFullscreenLock } from '../utils/fullscreen'

const navItems = [
  { to: '/venda', label: 'Venda', icon: IconPump },
  { to: '/produtos', label: 'Produtos', icon: IconStore },
  { to: '/pagamento', label: 'Pagar', icon: IconPay },
  { to: '/abastecidas', label: 'Abast.', icon: IconPump },
  { to: '/cancelamento', label: 'Cancel.', icon: IconCancel },
  { to: '/adm', label: 'ADM', icon: IconAdm },
]

function IconPump() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12" />
      <path d="M4 20h12" />
      <path d="M14 11h2.5a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9.5L18 6" />
      <path d="M8 10h4" />
    </svg>
  )
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 9h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 9Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function IconPay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  )
}

function IconCancel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M8 8l8 8" />
    </svg>
  )
}

function IconAdm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4Z" />
      <path d="M9.5 12.5l1.8 1.8 3.4-3.6" />
    </svg>
  )
}

const titles: Record<string, string> = {
  '/venda': 'Ponto de Venda',
  '/produtos': 'Produtos',
  '/pagamento': 'Pagamento',
  '/abastecidas': 'Abastecidas',
  '/cancelamento': 'Cancelamento',
  '/adm': 'Administração',
  '/caixa': 'Controle de Caixa',
  '/relatorios': 'Relatórios',
  '/reimpressao': 'Reimpressão NFC-e / NF-e',
  '/config': 'Configurações',
}

export function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'PDV Posto'
  const operator = operators[0]
  const { connection } = useConcentrador()
  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Tela cheia travada: Esc/F11 não devem tirar o PDV da tela cheia.
  useEffect(() => startFullscreenLock(), [])

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand-mark" title="Modulo Info">
          <img src="/brand/modulo-info.png" alt="Modulo Info" className="brand-logo" />
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div className="nav-spacer" />
        <button
          className="nav-item"
          type="button"
          onClick={() => { window.location.href = '/' }}
          title="Sair"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span>Sair</span>
        </button>
      </aside>

      <div className="main-area">
        <header className="top-bar">
          <div className="top-bar-title">
            <h1>{title}</h1>
            <strong className="station-name">{station.name}</strong>
          </div>
          <div className="top-meta">
            <span
              className={`chip ${connection.connected ? 'ok' : 'danger'}`}
              title={connection.message}
            >
              {connection.connected ? 'Concentrador conectado' : 'Concentrador offline'}
            </span>
            <span className="chip ok">Caixa aberto</span>
            <span className="chip">{operator.name}</span>
            <span className="chip">{now}</span>
          </div>
        </header>
        {!connection.connected ? (
          <div
            role="status"
            style={{
              margin: '0 16px 8px',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.1)',
              color: '#fecaca',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            Aguardando o concentrador neste PC…
          </div>
        ) : null}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
