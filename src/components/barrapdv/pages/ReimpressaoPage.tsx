import { useEffect, useMemo, useRef, useState } from 'react'
import { AdmBackButton } from '../components/AdmBackButton'
import { useAlert } from '../context/AlertContext'
import { formatCurrency } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'
import { fiscalService, type FiscalDocTipo, type FiscalDocument } from '../services/fiscal'

type FiltroTipo = 'Todos' | FiscalDocTipo

const FILTROS: FiltroTipo[] = ['Todos', 'NFC-e', 'NF-e']

export function ReimpressaoPage() {
  const { showAlert } = useAlert()
  const [filtro, setFiltro] = useState<FiltroTipo>('Todos')
  const [busca, setBusca] = useState('')
  const [docs, setDocs] = useState<FiscalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reprintingId, setReprintingId] = useState<string | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  async function loadDocs() {
    setLoading(true)
    try {
      const list = await fiscalService.list()
      setDocs(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    } catch (err) {
      showAlert({
        title: 'Reimpressão',
        message: err instanceof Error ? err.message : 'Falha ao carregar documentos.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTimeout(() => { void loadDocs() }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return docs.filter((doc) => {
      const byTipo = filtro === 'Todos' || doc.tipo === filtro
      if (!byTipo) return false
      if (!q) return true
      return (
        doc.numero.includes(q) ||
        doc.chave.includes(q) ||
        doc.cliente.toLowerCase().includes(q) ||
        doc.tipo.toLowerCase().includes(q)
      )
    })
  }, [busca, docs, filtro])

  const ids = useMemo(() => filtrados.map((doc) => doc.id), [filtrados])

  async function reimprimir(doc: FiscalDocument) {
    setReprintingId(doc.id)
    try {
      const result = await fiscalService.reprint({
        documentId: doc.id,
        openDialog: false,
        direct: true,
      })
      showAlert({
        title: result.ok ? `Reimpressão ${doc.tipo}` : `Falha ${doc.tipo}`,
        message: result.message,
        buttonLabel: 'OK',
      })
    } catch (err) {
      showAlert({
        title: `Reimpressão ${doc.tipo}`,
        message: err instanceof Error ? err.message : 'Falha na reimpressão.',
      })
    } finally {
      setReprintingId(null)
    }
  }

  useGridKeyboardNav({
    ids,
    selectedId,
    setSelectedId,
    containerRef: tableWrapRef,
    enabled: !loading && !reprintingId,
    allowArrowsWhileTyping: true,
    filterOptions: FILTROS,
    filterValue: filtro,
    onFilterChange: (value) => setFiltro(value as FiltroTipo),
    onEnter: (id) => {
      const doc = filtrados.find((d) => d.id === id)
      if (doc) void reimprimir(doc)
    },
  })

  return (
    <div className="reimpressao-layout">
      <AdmBackButton />

      <section className="panel reimpressao-panel">
        <div className="panel-header">
          <h2>Reimpressão NFC-e / NF-e</h2>
          <span className="chip">Cupons · ↑↓ ←→ Enter</span>
        </div>

        <div className="reimpressao-toolbar">
          <div className="filters">
            {FILTROS.map((tipo) => (
              <button
                key={tipo}
                type="button"
                className={`filter-chip${filtro === tipo ? ' active' : ''}`}
                onClick={() => setFiltro(tipo)}
              >
                {tipo}
              </button>
            ))}
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label htmlFor="busca-doc">Buscar</label>
            <input
              id="busca-doc"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Número, chave ou cliente…"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty">Carregando documentos…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty">Nenhum cupom NFC-e / NF-e encontrado.</div>
        ) : (
          <div className="table-wrap" ref={tableWrapRef}>
            <table className="data abastecidas-table reimpressao-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Série</th>
                  <th>Emissão</th>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Chave</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((doc) => {
                  const selected = selectedId === doc.id
                  return (
                    <tr
                      key={doc.id}
                      data-row-id={doc.id}
                      className={selected ? 'selected' : undefined}
                      onClick={() => setSelectedId(doc.id)}
                      onDoubleClick={() => void reimprimir(doc)}
                    >
                      <td>
                        <span className={`doc-tipo ${doc.tipo === 'NF-e' ? 'nfe' : 'nfce'}`}>
                          {doc.tipo}
                        </span>
                      </td>
                      <td>
                        <strong>{doc.numero}</strong>
                      </td>
                      <td>{doc.serie}</td>
                      <td>
                        {doc.emissao} {doc.hora}
                      </td>
                      <td>{doc.cliente}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(doc.valor)}</td>
                      <td>
                        <code className="abastecidas-cbc-id">{doc.chave}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-compact"
                          disabled={reprintingId === doc.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedId(doc.id)
                            void reimprimir(doc)
                          }}
                        >
                          {reprintingId === doc.id ? '…' : 'Reimprimir'}
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
