import { useMemo, useRef, useState } from 'react'
import { AdmBackButton } from '../components/AdmBackButton'
import { useConcentrador } from '../context/ConcentradorContext'
import { formatCurrency } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'

/** Totais do turno já recebidos (layout — ainda sem persistência de cupons). */
const turnoVendas = {
  combustiveisRecebidos: 28450.4,
  produtos: 1820.75,
}

const receitasPorDocumento = [
  { id: 'dinheiro', label: 'Dinheiro', amount: 4210.35 },
  { id: 'debito', label: 'Cartão Débito', amount: 9840.5 },
  { id: 'credito', label: 'Cartão Crédito', amount: 7120.0 },
  { id: 'pix', label: 'PIX', amount: 8095.2 },
  { id: 'vale', label: 'Vale / Frota', amount: 1005.1 },
]

const fundoCaixa = 300
const totalSangrias = 700
const totalSuprimentos = 150

function parseMoneyInput(raw: string): number {
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

export function CaixaPage() {
  const { tempRows, fillings } = useConcentrador()
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(receitasPorDocumento[0]?.id ?? null)

  const combustiveisRecebidos = turnoVendas.combustiveisRecebidos
  const combustiveisEmAberto = useMemo(
    () => fillings.reduce((sum, row) => sum + row.total, 0),
    [fillings],
  )
  const qtdEmAberto = fillings.length
  const qtdBaixados = useMemo(
    () => tempRows.filter((row) => row.situacao === 1).length,
    [tempRows],
  )

  const totalProdutos = turnoVendas.produtos
  const totalVendas = combustiveisRecebidos + totalProdutos
  const totalReceitas = receitasPorDocumento.reduce((sum, item) => sum + item.amount, 0)
  const dinheiroRecebido =
    receitasPorDocumento.find((item) => item.id === 'dinheiro')?.amount ?? 0

  const esperadoEmCaixa =
    fundoCaixa + dinheiroRecebido + totalSuprimentos - totalSangrias

  const [contadoRaw, setContadoRaw] = useState(
    esperadoEmCaixa.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  )

  const valorContado = useMemo(() => parseMoneyInput(contadoRaw), [contadoRaw])
  const sobraFalta = valorContado - esperadoEmCaixa
  const sobraFaltaLabel =
    Math.abs(sobraFalta) < 0.005 ? 'Ok' : sobraFalta > 0 ? 'Sobra' : 'Falta'
  const sobraFaltaClass =
    Math.abs(sobraFalta) < 0.005 ? 'ok' : sobraFalta > 0 ? 'ok' : 'danger'

  const receitaIds = useMemo(() => receitasPorDocumento.map((item) => item.id), [])

  useGridKeyboardNav({
    ids: receitaIds,
    selectedId,
    setSelectedId,
    containerRef: tableWrapRef,
    allowArrowsWhileTyping: false,
  })

  return (
    <div className="caixa-layout">
      <AdmBackButton />

      <div className="stats-grid caixa-stats">
        <div className="stat-card">
          <div className="label">Combustíveis vendidos</div>
          <div className="value">{formatCurrency(combustiveisRecebidos)}</div>
          <div className="stat-sub">Já recebidos no turno</div>
        </div>
        <div className="stat-card warn-card">
          <div className="label">Combustíveis em aberto</div>
          <div className="value">{formatCurrency(combustiveisEmAberto)}</div>
          <div className="stat-sub">
            {qtdEmAberto} na tela de venda · a receber
            {qtdBaixados > 0 ? ` · ${qtdBaixados} baixados` : ''}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Venda produtos</div>
          <div className="value">{formatCurrency(totalProdutos)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total de vendas</div>
          <div className="value">{formatCurrency(totalVendas)}</div>
          <div className="stat-sub">Vendidos + produtos (sem abertos)</div>
        </div>
        <div className={`stat-card sobra-card ${sobraFaltaClass}`}>
          <div className="label">Sobra / Falta</div>
          <div className="value">
            {sobraFaltaLabel === 'Ok' ? '—' : sobraFaltaLabel}{' '}
            {formatCurrency(Math.abs(sobraFalta))}
          </div>
        </div>
      </div>

      <div className="caixa-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Receitas por documentos</h2>
            <span className="chip">↑↓ · {formatCurrency(totalReceitas)}</span>
          </div>
          <div className="table-wrap" ref={tableWrapRef}>
            <table className="data">
              <thead>
                <tr>
                  <th>Documento / forma</th>
                  <th>Valor</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {receitasPorDocumento.map((item) => {
                  const share = totalReceitas > 0 ? (item.amount / totalReceitas) * 100 : 0
                  const selected = selectedId === item.id
                  return (
                    <tr
                      key={item.id}
                      data-row-id={item.id}
                      className={selected ? 'selected' : undefined}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>{item.label}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                      <td>{share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total receitas</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(totalReceitas)}</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="caixa-hint">
            Soma das vendas já recebidas (combustível + produtos):{' '}
            <strong>{formatCurrency(totalVendas)}</strong>
            {' · '}
            Em aberto na venda:{' '}
            <strong>{formatCurrency(combustiveisEmAberto)}</strong>
            {Math.abs(totalVendas - totalReceitas) > 0.01 ? (
              <>
                {' '}
                · Diferença documentos:{' '}
                <strong>{formatCurrency(totalVendas - totalReceitas)}</strong>
              </>
            ) : (
              <> · Conferido com o total de vendas</>
            )}
          </p>
        </section>

        <section className="panel caixa-conferencia">
          <div className="panel-header">
            <h2>Conferência de caixa</h2>
            <span className={`chip ${sobraFaltaClass}`}>
              {sobraFaltaLabel === 'Ok' ? 'Bateu' : sobraFaltaLabel}
            </span>
          </div>
          <div className="caixa-conferencia-body">
            <div className="caixa-line">
              <span>Fundo de caixa</span>
              <strong>{formatCurrency(fundoCaixa)}</strong>
            </div>
            <div className="caixa-line">
              <span>Recebido em dinheiro</span>
              <strong>{formatCurrency(dinheiroRecebido)}</strong>
            </div>
            <div className="caixa-line">
              <span>Suprimentos</span>
              <strong>{formatCurrency(totalSuprimentos)}</strong>
            </div>
            <div className="caixa-line">
              <span>Sangrias</span>
              <strong className="neg">{formatCurrency(-totalSangrias)}</strong>
            </div>
            <div className="caixa-line total">
              <span>Esperado em caixa</span>
              <strong>{formatCurrency(esperadoEmCaixa)}</strong>
            </div>

            <label className="field" htmlFor="valor-contado">
              Valor contado
              <input
                id="valor-contado"
                inputMode="decimal"
                value={contadoRaw}
                onChange={(e) => setContadoRaw(e.target.value)}
                placeholder="0,00"
              />
            </label>

            <div className={`caixa-line sobra ${sobraFaltaClass}`}>
              <span>Sobra / Falta</span>
              <strong>
                {sobraFalta >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(sobraFalta))}
              </strong>
            </div>

            <button type="button" className="btn btn-secondary btn-lg btn-block">
              Sangria
            </button>
            <button type="button" className="btn btn-secondary btn-lg btn-block">
              Suprimento
            </button>
            <button type="button" className="btn btn-danger btn-lg btn-block">
              Fechar turno
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
