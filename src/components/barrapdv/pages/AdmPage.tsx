import { useNavigate } from 'react-router-dom'

function IconCash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7 12h.01M17 12h.01" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  )
}

const admActions = [
  {
    to: '/caixa',
    label: 'Caixa',
    description: 'Abertura, sangria, suprimento e fechamento do turno',
    icon: IconCash,
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    description: 'Vendas, combustíveis e desempenho do posto',
    icon: IconChart,
  },
  {
    to: '/reimpressao',
    label: 'Reimpressão',
    description: 'Reimpressão de cupons NFC-e e NF-e',
    icon: IconPrint,
  },
  {
    to: '/config',
    label: 'Configurações',
    description: 'Posto, concentrador, TEF, impressora e operadores',
    icon: IconGear,
  },
]

export function AdmPage() {
  const navigate = useNavigate()

  return (
    <div className="adm-layout">
      <section className="panel">
        <div className="panel-header">
          <h2>Administração</h2>
          <span className="chip">Menu administrativo</span>
        </div>
        <div className="adm-grid">
          {admActions.map((action) => (
            <button
              key={action.to}
              type="button"
              className="adm-card"
              onClick={() => navigate(action.to)}
            >
              <span className="adm-card-icon" aria-hidden>
                <action.icon />
              </span>
              <span className="adm-card-body">
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
