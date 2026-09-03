import { useEffect, useMemo, useRef, useState } from 'react'
import { AdmBackButton } from '../components/AdmBackButton'
import { useAlert } from '../context/AlertContext'
import { formatCurrency } from '../data/mock'
import { useGridKeyboardNav } from '../hooks/useGridKeyboardNav'
import { fiscalService, type FiscalDocTipo, type FiscalDocument } from '../services/fiscal'

type FiltroTipo = 'Todos' | FiscalDocTipo

const FILTROS: FiltroTipo[] = ['Todos', 'NFC-e', 'NF-e']

function statusLabel(status: FiscalDocument['status']) {
  switch (status) {
    case 'authorized':
      return 'Autorizada'
    case 'contingency':
      return 'Contingência'
    case 'cancelled':
      return 'Cancelada'
    case 'denied':
      return 'Denegada'
    case 'pending':
      return 'Pendente'
    case 'error':
      return 'Erro'
    default:
      return status
  }
}

export function CancelamentoPage() {
  const { showAlert, showConfirm } = useAlert()
  const [filtro, setFiltro] = useState<FiltroTipo>('Todos')
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState('')
  const [docs, setDocs] = useState<FiscalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  async function loadDocs() {
    setLoading(true)
    try {
      const [autorizadas, contingencia] = await Promise.all([
        fiscalService.list({ status: 'authorized' }),
        fiscalService.list({ status: 'contingency' }),
      ])
      const byId = new Map<string, FiscalDocument>()
      for (const doc of [...autorizadas, ...contingencia]) {
        byId.set(doc.id, doc)
      }
      const list = Array.from(byId.values()).sort((a, b) =>
        (b.issuedAt || '').localeCompare(a.issuedAt || ''),
      )
      setDocs(list)
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (err) {
      showAlert({
        title: 'Cancelamento',
        message: err instanceof Error ? err.message : 'Falha ao carregar documentos.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTimeout(() => {
      void loadDocs()
    }, 0)
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

  async function cancelar(doc: FiscalDocument) {
    const motivoTrim = motivo.trim()
    if (motivoTrim.length < 15) {
      showAlert({
        title: 'Cancelamento',
        message: 'Informe o motivo do cancelamento com pelo menos 15 caracteres.',
      })
      return
    }

    const ok = await showConfirm({
      title: `Cancelar ${doc.tipo} ${doc.numero}?`,
      message: `Cliente: ${doc.cliente}\nValor: ${formatCurrency(doc.valor)}\n\nMotivo:\n${motivoTrim}`,
      yesLabel: 'Cancelar nota',
      noLabel: 'Voltar',
    })
    if (!ok) return

    setCancelingId(doc.id)
    try {
      const result = await fiscalService.cancel({
        documentId: doc.id,
        motivo: motivoTrim,
      })
      showAlert({
        title: result.ok ? `${doc.tipo} cancelada` : `Falha ${doc.tipo}`,
        message: result.message,
        buttonLabel: 'OK',
      })
      setMotivo('')
      await loadDocs()
    } catch (err) {
      showAlert({
        title: `Cancelamento ${doc.tipo}`,
        message: err instanceof Error ? err.message : 'Falha ao cancelar a nota.',
      })
    } finally {
      setCancelingId(null)
    }
  }

  useGridKeyboardNav({
    ids,
    selectedId,
    setSelectedId,
    containerRef: tableWrapRef,
    enabled: !loading && !cancelingId,
    allowArrowsWhileTyping: true,
    filterOptions: FILTROS,
    filterValue: filtro,
    onFilterChange: (value) => setFiltro(value as FiltroTipo),
    onEnter: (id) => {
      const doc = filtrados.find((d) => d.id === id)
      if (doc) void cancelar(doc)
    },
  })

  return (
    <div className="reimpressao-layout">
      <AdmBackButton />

      <section className="panel reimpressao-panel">
        <div className="panel-header">
          <h2>Cancelamento NFC-e / NF-e</h2>
          <span className="chip">Notas autorizadas · ↑↓ ←→ Enter</span>
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
            <label htmlFor="busca-cancel">Buscar</label>
            <input
              id="busca-cancel"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Número, chave ou cliente…"
            />
          </div>
        </div>

        <div className="field" style={{ margin: '0 16px 12px' }}>
          <label htmlFor="motivo-cancel">Motivo do cancelamento</label>
          <textarea
            id="motivo-cancel"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo (mínimo 15 caracteres)…"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {loading ? (
          <div className="empty">Carregando documentos…</div>
        ) : filtrados.length === 0 ? (
          <div className="empty">Nenhuma NFC-e / NF-e autorizada para cancelar.</div>
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
                  <th>Situação</th>
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
                      onDoubleClick={() => void cancelar(doc)}
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
                      <td>{statusLabel(doc.status)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-compact"
                          disabled={cancelingId === doc.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedId(doc.id)
                            void cancelar(doc)
                          }}
                        >
                          {cancelingId === doc.id ? '…' : 'Cancelar'}
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
