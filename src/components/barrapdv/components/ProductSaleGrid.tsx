import { useMemo, useRef, useState } from 'react'
import { useCart } from '../context/CartContext'
import { formatCurrency, products } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'

const categories = ['Todos', ...Array.from(new Set(products.map((p) => p.category)))]

type Props = {
  /** Layout embutido na tela de venda (modo loja). */
  embedded?: boolean
}

/** Grade de produtos para venda rápida (conveniência / PDV loja). */
export function ProductSaleGrid({ embedded = false }: Props) {
  const { addItem } = useCart()
  const [category, setCategory] = useState('Todos')
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const byCat = category === 'Todos' || p.category === category
      const byQuery = p.name.toLowerCase().includes(query.toLowerCase())
      return byCat && byQuery
    })
  }, [category, query])

  const ids = useMemo(() => filtered.map((p) => p.id), [filtered])

  function add(id: string) {
    const product = products.find((p) => p.id === id)
    if (!product) return
    addItem({
      id: product.id,
      name: product.name,
      qty: 1,
      price: product.price,
      unit: product.unit,
      kind: 'produto',
      productCode: product.productCode,
    })
    setAdded(product.name)
    window.setTimeout(() => setAdded(null), 900)
  }

  useGridKeyboardNav({
    ids,
    selectedId,
    setSelectedId,
    containerRef: gridRef,
    allowArrowsWhileTyping: true,
    columns: embedded ? 3 : 4,
    onEnter: (id) => add(id),
  })

  return (
    <div className={`products-layout${embedded ? ' products-embedded' : ''}`}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          <label htmlFor={embedded ? 'search-venda' : 'search'}>Buscar produto</label>
          <input
            id={embedded ? 'search-venda' : 'search'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou código…"
            autoFocus={embedded}
          />
        </div>
        {added ? <span className="chip ok">Adicionado: {added}</span> : null}
        <span className="chip">↑↓←→ Enter</span>
      </div>

      <div className="filters">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-chip${category === cat ? ' active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="product-grid" ref={gridRef}>
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            data-row-id={p.id}
            className={`product-card${selectedId === p.id ? ' selected' : ''}`}
            onClick={() => {
              setSelectedId(p.id)
              add(p.id)
            }}
          >
            <div>
              <div className="cat">{p.category}</div>
              <div className="name">{p.name}</div>
            </div>
            <div className="price">{formatCurrency(p.price)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
