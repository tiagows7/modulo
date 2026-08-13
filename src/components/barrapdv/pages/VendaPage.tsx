import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../context/AlertContext'
import { useCart } from '../context/CartContext'
import { useConcentrador } from '../context/ConcentradorContext'
import {
  formatCurrency,
  formatLiters,
  formatUnitPrice,
  fuels,
  type Filling,
} from '../data/mock'

function PumpIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="pump-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path d="M4 21V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13" />
      <path d="M4 21h12" />
      <path d="M14 11h2.2a1.8 1.8 0 0 1 1.8 1.8V16a1.4 1.4 0 0 0 2.8 0V9.2L18 6" />
      <path d="M8 10h4" />
      {active ? <circle cx="10" cy="15" r="1.4" fill="currentColor" stroke="none" /> : null}
    </svg>
  )
}

export function VendaPage() {
  const navigate = useNavigate()
  const { showAlert } = useAlert()
  const { cart, total, addItem, removeItem, clearCart } = useCart()
  const { fillings, connection, acknowledgeFilling, baixaSemNota, reabrirAbastecimentos } =
    useConcentrador()
  const [selectedFilling, setSelectedFilling] = useState<string | null>(null)
  const [focusedFillingId, setFocusedFillingId] = useState<string | null>(null)
  /** Contagem de cliques no mesmo abastecimento (precisa de 2 para lançar). */
  const [clickSelect, setClickSelect] = useState<{ id: string; count: number } | null>(null)
  const fillingsListRef = useRef<HTMLDivElement | null>(null)

  const focusedFilling =
    fillings.find((f) => f.id === focusedFillingId) ??
    fillings.find((f) => f.id === selectedFilling) ??
    fillings[0]

  const fuelingNozzles = connection.nozzles.filter((n) => n.status === 'abastecendo')
  const disponiveis = fillings.filter((f) => f.status === 'disponivel').length

  useEffect(() => {
    if (fillings.length === 0) {
      if (focusedFillingId) setTimeout(() => setFocusedFillingId(null), 0)
      return
    }
    const stillVisible = focusedFillingId
      ? fillings.some((f) => f.id === focusedFillingId)
      : false
    if (!stillVisible) {
      setTimeout(() => setFocusedFillingId(fillings[0].id), 0)
    }
  }, [fillings, focusedFillingId])

  useEffect(() => {
    if (!focusedFillingId || !fillingsListRef.current) return
    const row = fillingsListRef.current.querySelector<HTMLElement>(
      `[data-filling-id="${CSS.escape(focusedFillingId)}"]`,
    )
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedFillingId])

  function moveFocus(delta: number) {
    if (fillings.length === 0) return
    const currentIndex = Math.max(
      0,
      fillings.findIndex((f) => f.id === focusedFillingId),
    )
    const nextIndex = Math.min(
      fillings.length - 1,
      Math.max(0, currentIndex + delta),
    )
    const next = fillings[nextIndex]
    if (!next || next.id === focusedFillingId) return
    setFocusedFillingId(next.id)
    setClickSelect(null)
  }

  function irParaPagamento() {
    if (cart.length === 0) {
      showAlert({
        title: 'Não há produtos informados',
        message:
          'O cupom está vazio. Selecione um abastecimento disponível ou um produto antes de ir para o pagamento.',
      })
      return
    }
    navigate('/pagamento')
  }

  async function importFilling(filling: Filling) {
    if (filling.status !== 'disponivel' || filling.situacao === 1) return
    const fuel = fuels.find((f) => f.id === filling.fuelId)
    if (!fuel) return
    setSelectedFilling(filling.id)
    setFocusedFillingId(filling.id)
    setClickSelect(null)
    addItem({
      id: filling.id,
      name: `${fuel.name} — Bico ${String(filling.nozzle).padStart(2, '0')}`,
      qty: filling.quantity,
      price: filling.unitPrice,
      unit: 'L',
      kind: 'combustivel',
      pumpId: filling.nozzle,
      productCode: fuel.productCode,
    })
    await acknowledgeFilling(filling.id)
  }

  function onFillingClick(filling: Filling) {
    if (filling.status !== 'disponivel' || filling.situacao === 1) return
    setFocusedFillingId(filling.id)

    const nextCount =
      clickSelect?.id === filling.id ? Math.min(clickSelect.count + 1, 2) : 1

    setClickSelect({ id: filling.id, count: nextCount })

    if (nextCount >= 2) {
      void importFilling(filling)
    }
  }

  function limparCupom() {
    const abastecimentoIds = cart
      .filter((item) => item.kind === 'combustivel')
      .map((item) => item.id)
    if (abastecimentoIds.length > 0) {
      reabrirAbastecimentos(abastecimentoIds)
    }
    clearCart()
    setSelectedFilling(null)
    setClickSelect(null)
  }

  function removerDoCupom(itemId: string) {
    const item = cart.find((i) => i.id === itemId)
    if (item?.kind === 'combustivel') {
      reabrirAbastecimentos([item.id])
    }
    removeItem(itemId)
  }

  async function onBaixaSemNota(filling: Filling) {
    if (filling.situacao === 1) return
    await baixaSemNota(filling.id)
    if (focusedFillingId === filling.id) setFocusedFillingId(null)
    if (selectedFilling === filling.id) setSelectedFilling(null)
    if (clickSelect?.id === filling.id) setClickSelect(null)
  }

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const el = target as HTMLElement | null
      const tag = el?.tagName?.toLowerCase()
      return tag === 'input' || tag === 'textarea' || Boolean(el?.isContentEditable)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveFocus(1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(-1)
        return
      }
      if (event.key === 'F6') {
        event.preventDefault()
        if (!focusedFilling || focusedFilling.situacao === 1) return
        void onBaixaSemNota(focusedFilling)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusedFilling, focusedFillingId, fillings, selectedFilling, clickSelect, baixaSemNota])

  return (
    <div className="venda-layout">

      <div className="venda-left">
        <section className="panel fillings-panel">
          <div className="panel-header">
            <h2>Abastecimentos</h2>
            <div className="fillings-header-meta">
              {fuelingNozzles.length > 0 && (
                <div className="pump-icon-strip header-pumps" role="list">
                  {fuelingNozzles.map((n) => {
                    const bico = (n.bicoCode || String(n.nozzle)).padStart(2, '0').toUpperCase()
                    return (
                      <div
                        key={bico}
                        role="listitem"
                        className="pump-icon-card active"
                        title={`Bico ${bico} — Abastecendo`}
                      >
                        <PumpIcon active />
                        <strong>{bico}</strong>
                      </div>
                    )
                  })}
                </div>
              )}
              <span className="chip">
                {disponiveis} disponível{disponiveis === 1 ? '' : 'eis'}
              </span>
            </div>
          </div>

          <div className="fillings-table">
            <div className="fillings-head" role="row">
              <div className="fillings-head-cols">
                <span>Bico</span>
                <span>Produto</span>
                <span>Quantidade</span>
                <span>Valor unitário</span>
                <span>Valor total</span>
                <span>Hora</span>
              </div>
              <span className="fillings-head-action">Ação</span>
            </div>

            <div className="fillings-list" ref={fillingsListRef}>
              {fillings.length === 0 ? (
                <div className="empty">
                  Aguardando abastecimentos do concentrador Companytec CBC…
                </div>
              ) : (
                fillings.map((filling) => {
                  const fuel = fuels.find((f) => f.id === filling.fuelId)
                  const inCart = cart.some((i) => i.id === filling.id)
                  const selectable = filling.status === 'disponivel' && filling.situacao === 0
                  const clicks =
                    clickSelect?.id === filling.id ? clickSelect.count : 0

                  return (
                    <div
                      key={filling.id}
                      data-filling-id={filling.id}
                      className={[
                        'filling-card',
                        filling.status,
                        selectedFilling === filling.id || inCart ? 'selected' : '',
                        focusedFillingId === filling.id ? 'focused' : '',
                        clicks === 1 ? 'click-1' : '',
                        !selectable ? 'disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setFocusedFillingId(filling.id)}
                    >
                      <button
                        type="button"
                        className="filling-main"
                        onClick={() => onFillingClick(filling)}
                        onFocus={() => setFocusedFillingId(filling.id)}
                        aria-disabled={!selectable}
                        disabled={!selectable}
                        title={
                          selectable
                            ? clicks === 0
                              ? 'Clique 2 vezes para lançar no cupom'
                              : clicks === 1
                                ? '1 clique restante para lançar'
                                : undefined
                            : undefined
                        }
                      >
                        <div className="filling-grid">
                          <strong className="value-lg">
                            {String(filling.nozzle).padStart(2, '0')}
                          </strong>
                          <strong>{fuel?.name ?? '—'}</strong>
                          <strong>{formatLiters(filling.quantity)}</strong>
                          <strong>{formatUnitPrice(filling.unitPrice)}</strong>
                          <strong className="value-total">{formatCurrency(filling.total)}</strong>
                          <strong>{filling.time}</strong>
                        </div>
                      </button>
                      <div className="filling-actions">
                        <button
                          type="button"
                          className="btn btn-ghost filling-baixa-btn"
                          title="Baixar abastecimento sem emitir nota (F6)"
                          onClick={(e) => {
                            e.stopPropagation()
                            void onBaixaSemNota(filling)
                          }}
                        >
                          Baixar (F6)
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="fillings-operator">
              <span>Operador do abastecimento</span>
              <strong>{focusedFilling?.operator ?? '—'}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="venda-right">
        <section className="panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>Cupom atual</h2>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                limparCupom()
              }}
            >
              Limpar
            </button>
          </div>

          <div className="cart-list">
            {cart.length === 0 ? (
              <div className="empty">
                Nenhum item no cupom. Selecione um abastecimento disponível ou um produto.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <div className="title">{item.name}</div>
                    <div className="sub">
                      {item.qty} {item.unit} ×{' '}
                      {item.unit === 'L' ? formatUnitPrice(item.price) : formatCurrency(item.price)}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ minHeight: 32, padding: '0 8px', marginTop: 4 }}
                      onClick={() => removerDoCupom(item.id)}
                    >
                      Remover
                    </button>
                  </div>
                  <div className="value">
                    {formatCurrency(
                      item.qty * item.price - (item.discount ?? 0),
                    )}
                    {(item.discount ?? 0) > 0 ? (
                      <small className="cart-item-discount">
                        −{formatCurrency(item.discount ?? 0)}
                      </small>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="cart-footer">
            <div className="total-row">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={irParaPagamento}>
              Ir para pagamento
            </button>
            <button type="button" className="btn btn-secondary btn-block">
              Suspender cupom
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
