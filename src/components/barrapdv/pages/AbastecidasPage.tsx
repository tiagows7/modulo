import { useMemo, useRef, useState } from 'react'
import { useConcentrador } from '../context/ConcentradorContext'
import {
  formatCurrency,
  formatLiters,
  formatUnitPrice,
  fuels,
} from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'

function sortBaixadas<T extends { date: string; time: string; receivedAt?: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const aKey = a.receivedAt || `${a.date} ${a.time}`
    const bKey = b.receivedAt || `${b.date} ${b.time}`
    return bKey.localeCompare(aKey)
  })
}

export function AbastecidasPage() {
  const { tempRows, reabrirAbastecimentos } = useConcentrador()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  const baixadas = useMemo(
    () => sortBaixadas(tempRows.filter((row) => row.situacao === 1)),
    [tempRows],
  )

  const ids = useMemo(() => baixadas.map((row) => row.id), [baixadas])

  const totalLitros = useMemo(
    () => baixadas.reduce((sum, row) => sum + row.quantity, 0),
    [baixadas],
  )
  const totalValor = useMemo(
    () => baixadas.reduce((sum, row) => sum + row.total, 0),
    [baixadas],
  )

  useGridKeyboardNav({
    ids,
    selectedId,
    setSelectedId,
    containerRef: tableWrapRef,
    allowArrowsWhileTyping: false,
  })

  return (
    <div className="abastecidas-layout">
      <div className="stats-grid abastecidas-stats">
        <div className="stat-card">
          <div className="label">Baixadas</div>
          <div className="value">{baixadas.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Litros</div>
          <div className="value">{formatLiters(totalLitros)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total</div>
          <div className="value">{formatCurrency(totalValor)}</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Abastecidas baixadas</h2>
          <span className="chip">Situação 1 · ↑↓ navegar</span>
        </div>

        {baixadas.length === 0 ? (
          <div className="empty">Nenhuma abastecida baixada na memória neste momento.</div>
        ) : (
          <div className="table-wrap" ref={tableWrapRef}>
            <table className="data abastecidas-table">
              <thead>
                <tr>
                  <th>Bico</th>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Preço</th>
                  <th>Total</th>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Operador</th>
                  <th>CBC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {baixadas.map((row) => {
                  const fuel = fuels.find((f) => f.id === row.fuelId)
                  const selected = selectedId === row.id
                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      className={selected ? 'selected' : undefined}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <strong>{String(row.nozzle).padStart(2, '0')}</strong>
                      </td>
                      <td>{fuel?.name ?? row.cbcProductCode}</td>
                      <td>{formatLiters(row.quantity)}</td>
                      <td>{formatUnitPrice(row.unitPrice)}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(row.total)}</td>
                      <td>{row.date}</td>
                      <td>{row.time}</td>
                      <td>{row.operator}</td>
                      <td>
                        <code className="abastecidas-cbc-id">{row.cbcSupplyId}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          title="Reabrir no grid de venda (situação 0)"
                          onClick={(e) => {
                            e.stopPropagation()
                            reabrirAbastecimentos([row.id])
                          }}
                        >
                          Reabrir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
