import { useEffect, useMemo, useRef, useState } from 'react'
import { AdmBackButton } from '../components/AdmBackButton'
import { formatCurrency } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'

const byFuel = [
  { id: 'gc', name: 'Gasolina Comum', liters: 1840.5, amount: 10840.55 },
  { id: 'ga', name: 'Gasolina Aditivada', liters: 620.0, amount: 3837.8 },
  { id: 'et', name: 'Etanol', liters: 1120.3, amount: 4470.0 },
  { id: 'd10', name: 'Diesel S10', liters: 2310.0, amount: 13374.9 },
  { id: 'd500', name: 'Diesel S500', liters: 410.0, amount: 2291.9 },
]

const byPayment = [
  { id: 'pix', name: 'PIX', amount: 12540.2, share: '36%' },
  { id: 'debito', name: 'Cartão Débito', amount: 9840.5, share: '28%' },
  { id: 'credito', name: 'Cartão Crédito', amount: 7120.0, share: '20%' },
  { id: 'dinheiro', name: 'Dinheiro', amount: 4210.35, share: '12%' },
  { id: 'vale', name: 'Vale / Frota', amount: 1104.1, share: '4%' },
]

type PanelId = 'fuel' | 'pay'

export function RelatoriosPage() {
  const totalFuel = byFuel.reduce((s, i) => s + i.amount, 0)
  const [activePanel, setActivePanel] = useState<PanelId>('fuel')
  const [selectedFuelId, setSelectedFuelId] = useState<string | null>(byFuel[0]?.id ?? null)
  const [selectedPayId, setSelectedPayId] = useState<string | null>(byPayment[0]?.id ?? null)
  const fuelWrapRef = useRef<HTMLDivElement | null>(null)
  const payWrapRef = useRef<HTMLDivElement | null>(null)

  const fuelIds = useMemo(() => byFuel.map((row) => row.id), [])
  const payIds = useMemo(() => byPayment.map((row) => row.id), [])

  useGridKeyboardNav({
    ids: fuelIds,
    selectedId: selectedFuelId,
    setSelectedId: setSelectedFuelId,
    containerRef: fuelWrapRef,
    enabled: activePanel === 'fuel',
    allowArrowsWhileTyping: false,
  })

  useGridKeyboardNav({
    ids: payIds,
    selectedId: selectedPayId,
    setSelectedId: setSelectedPayId,
    containerRef: payWrapRef,
    enabled: activePanel === 'pay',
    allowArrowsWhileTyping: false,
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      setActivePanel(event.key === 'ArrowRight' ? 'pay' : 'fuel')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div>
      <AdmBackButton />
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Vendas do dia</div>
          <div className="value">{formatCurrency(34815.15)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Litros totais</div>
          <div className="value">6.300,80</div>
        </div>
        <div className="stat-card">
          <div className="label">Ticket médio</div>
          <div className="value">{formatCurrency(142.9)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Cupons</div>
          <div className="value">243</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section
          className={`panel${activePanel === 'fuel' ? ' grid-panel-active' : ''}`}
          onClick={() => setActivePanel('fuel')}
        >
          <div className="panel-header">
            <h2>Por combustível</h2>
            <span className="chip">
              {activePanel === 'fuel' ? '↑↓ · ' : ''}
              {formatCurrency(totalFuel)}
            </span>
          </div>
          <div className="table-wrap" ref={fuelWrapRef}>
            <table className="data">
              <thead>
                <tr>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {byFuel.map((row) => (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    className={selectedFuelId === row.id ? 'selected' : undefined}
                    onClick={() => {
                      setActivePanel('fuel')
                      setSelectedFuelId(row.id)
                    }}
                  >
                    <td>{row.name}</td>
                    <td>{row.liters.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td>{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`panel${activePanel === 'pay' ? ' grid-panel-active' : ''}`}
          onClick={() => setActivePanel('pay')}
        >
          <div className="panel-header">
            <h2>Por forma de pagamento</h2>
            <span className="chip">{activePanel === 'pay' ? '↑↓ · ativo' : '←→ painel'}</span>
          </div>
          <div className="table-wrap" ref={payWrapRef}>
            <table className="data">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th>Participação</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {byPayment.map((row) => (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    className={selectedPayId === row.id ? 'selected' : undefined}
                    onClick={() => {
                      setActivePanel('pay')
                      setSelectedPayId(row.id)
                    }}
                  >
                    <td>{row.name}</td>
                    <td>{row.share}</td>
                    <td>{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
