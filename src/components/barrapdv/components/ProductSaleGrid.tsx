import { useEffect, useMemo, useRef, useState } from 'react'
import { useAlert } from '../context/AlertContext'
import { useCart } from '../context/CartContext'
import { formatCurrency } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'
import {
  buscarProdutoPorCodigo,
  listarProdutosAtivos,
  parseCodigoQuantidade,
  type ProdutoVenda,
} from '../services/produtos/buscarProduto'

type Props = {
  /** Layout embutido na tela de venda (modo loja): só código + preview. */
  embedded?: boolean
}

type PreviewItem = {
  descricao: string
  qty: number
  unitario: number
  total: number
  codigo: string
}

/** Grade / pesquisa de produtos (PDV loja). */
export function ProductSaleGrid({ embedded = false }: Props) {
  const { addItem } = useCart()
  const { showAlert } = useAlert()
  const [query, setQuery] = useState('')
  const [scan, setScan] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewItem | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dbProducts, setDbProducts] = useState<ProdutoVenda[]>([])
  const [loading, setLoading] = useState(!embedded)
  const [busy, setBusy] = useState(false)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const scanRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (embedded) return
    let cancelled = false
    setLoading(true)
    void listarProdutosAtivos()
      .then((rows) => {
        if (!cancelled) setDbProducts(rows)
      })
      .catch(() => {
        if (!cancelled) setDbProducts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [embedded])

  const filteredDb = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dbProducts.filter((p) => {
      if (!q) return true
      return (
        p.descricao.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.codigo_barras ?? '').toLowerCase().includes(q)
      )
    })
  }, [dbProducts, query])

  const ids = useMemo(() => filteredDb.map((p) => p.id), [filteredDb])

  function flashAdded(name: string) {
    setAdded(name)
    window.setTimeout(() => setAdded(null), 900)
  }

  function addDbProduct(product: ProdutoVenda, qty: number) {
    const unitario = product.preco_venda
    const total = Math.round(qty * unitario * 100) / 100
    addItem({
      id: product.id,
      name: product.descricao,
      qty,
      price: unitario,
      unit: 'UN',
      kind: 'produto',
      productCode: product.codigo,
    })
    setPreview({
      descricao: product.descricao,
      qty,
      unitario,
      total,
      codigo: product.codigo_barras || product.codigo,
    })
    flashAdded(product.descricao)
  }

  async function submitScan() {
    const raw = scan.trim()
    if (!raw || busy) return

    const { qty, code } = parseCodigoQuantidade(raw)
    if (!code) return

    setBusy(true)
    try {
      const product = await buscarProdutoPorCodigo(code)
      if (!product) {
        setPreview(null)
        showAlert({
          title: 'Produto não encontrado',
          message: `Nenhum produto ativo com código ou código de barras "${code}".`,
        })
        return
      }
      addDbProduct(product, qty)
      setScan('')
      scanRef.current?.focus()
    } catch (err) {
      showAlert({
        title: 'Erro na pesquisa',
        message:
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar a tabela de produtos.',
      })
    } finally {
      setBusy(false)
    }
  }

  useGridKeyboardNav({
    ids,
    selectedId,
    setSelectedId,
    containerRef: gridRef,
    allowArrowsWhileTyping: true,
    columns: 4,
    enabled: !embedded,
    onEnter: (id) => {
      const product = filteredDb.find((p) => p.id === id)
      if (product) addDbProduct(product, 1)
    },
  })

  if (embedded) {
    return (
      <div className="products-layout products-embedded">
        <div className="loja-scan-row">
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label htmlFor="search-venda">Código de barras / código interno</label>
            <input
              id="search-venda"
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitScan()
                }
              }}
              placeholder="Ex.: 789… · 2*789… · 2.789… · código interno"
              autoFocus
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ alignSelf: 'end', minHeight: 42 }}
            onClick={() => void submitScan()}
            disabled={busy || !scan.trim()}
          >
            Incluir
          </button>
          {added ? (
            <span className="chip ok" style={{ alignSelf: 'end' }}>
              Adicionado
            </span>
          ) : null}
        </div>

        <div className="loja-preview" aria-live="polite">
          {preview ? (
            <>
              <strong className="loja-preview-desc">{preview.descricao}</strong>
              <div className="loja-preview-vals">
                <div>
                  <span>Código</span>
                  <strong>{preview.codigo}</strong>
                </div>
                <div>
                  <span>Qtd</span>
                  <strong>{preview.qty}</strong>
                </div>
                <div>
                  <span>Unitário</span>
                  <strong>{formatCurrency(preview.unitario)}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong className="loja-preview-total">
                    {formatCurrency(preview.total)}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="loja-preview-empty">
              Digite o código e pressione Enter. Quantidade:{' '}
              <code>2*codigo</code> ou <code>2.codigo</code>. Para lista e filtro, use{' '}
              <strong>Produtos</strong>.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="products-layout">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          <label htmlFor="search">Filtrar lista</label>
          <input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Descrição, código ou código de barras…"
            autoFocus
          />
        </div>
        {added ? <span className="chip ok">Adicionado: {added}</span> : null}
        <span className="chip">↑↓←→ Enter</span>
      </div>

      <div className="product-grid" ref={gridRef}>
        {loading ? (
          <div className="empty">Carregando produtos…</div>
        ) : filteredDb.length === 0 ? (
          <div className="empty">Nenhum produto ativo encontrado.</div>
        ) : (
          filteredDb.map((p) => (
            <button
              key={p.id}
              type="button"
              data-row-id={p.id}
              className={`product-card${selectedId === p.id ? ' selected' : ''}`}
              onClick={() => {
                setSelectedId(p.id)
                addDbProduct(p, 1)
              }}
            >
              <div>
                <div className="cat">{p.codigo_barras || p.codigo}</div>
                <div className="name">{p.descricao}</div>
              </div>
              <div className="price">{formatCurrency(p.preco_venda)}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
