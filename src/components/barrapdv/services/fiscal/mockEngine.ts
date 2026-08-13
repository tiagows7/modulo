import type { CartItem } from '../../data/mock'
import { FISCAL_CONFIG } from './config'
import type {
  FiscalBuyer,
  FiscalDocTipo,
  FiscalDocument,
  FiscalEmitRequest,
  FiscalListFilter,
  FiscalPaymentLine,
} from './types'

function pad(n: number, size: number) {
  return String(n).padStart(size, '0')
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function nowParts(d = new Date()) {
  const emissao = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { emissao, hora, issuedAt: d.toISOString() }
}

function buildChave(tipo: FiscalDocTipo, numero: number) {
  const uf = '35'
  const aamm = (() => {
    const d = new Date()
    return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}`
  })()
  const cnpj = onlyDigits(FISCAL_CONFIG.emitter.cnpj).padStart(14, '0').slice(0, 14)
  const mod = tipo === 'NFC-e' ? '65' : '55'
  const serie = pad(Number(FISCAL_CONFIG.series[tipo] || 1), 3)
  const nNF = pad(numero, 9)
  const tpEmis = '1'
  const cNF = pad(Math.floor(Math.random() * 1e8), 8)
  const base = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  const dv = String(base.split('').reduce((s, c) => s + Number(c), 0) % 10)
  return `${base}${dv}`
}

const seedItems = (name: string, valor: number): CartItem[] => [
  { id: `seed-${name}`, name, qty: 1, price: valor, unit: 'UN', kind: 'produto' },
]

/** Documentos iniciais (mesmo conteúdo que a reimpressão usava localmente). */
function createSeedDocuments(): FiscalDocument[] {
  const base: Omit<FiscalDocument, 'id' | 'chave' | 'items' | 'payments' | 'issuedAt' | 'status' | 'saleRef'>[] =
    [
      {
        tipo: 'NFC-e',
        numero: '001042',
        serie: '1',
        emissao: '22/07/2026',
        hora: '10:42',
        valor: 257.33,
        cliente: 'Consumidor final',
      },
      {
        tipo: 'NFC-e',
        numero: '001043',
        serie: '1',
        emissao: '22/07/2026',
        hora: '13:05',
        valor: 89.5,
        cliente: 'Consumidor final',
      },
      {
        tipo: 'NF-e',
        numero: '000188',
        serie: '1',
        emissao: '22/07/2026',
        hora: '15:20',
        valor: 463.2,
        cliente: 'Transportes Horizonte Ltda',
      },
      {
        tipo: 'NFC-e',
        numero: '001044',
        serie: '1',
        emissao: '22/07/2026',
        hora: '16:48',
        valor: 142.9,
        cliente: 'Consumidor final',
      },
      {
        tipo: 'NF-e',
        numero: '000189',
        serie: '1',
        emissao: '22/07/2026',
        hora: '18:10',
        valor: 1280.0,
        cliente: 'Construtora Vale Norte',
      },
    ]

  return base.map((row, index) => {
    const numeroInt = Number(row.numero)
    const chave = buildChave(row.tipo, numeroInt)
    return {
      ...row,
      id: `seed-${index + 1}`,
      chave,
      status: 'authorized' as const,
      saleRef: `SEED${pad(index + 1, 6)}`,
      issuedAt: `2026-07-22T${row.hora}:00.000Z`,
      protocol: `135${pad(numeroInt, 12)}`,
      items: seedItems(row.tipo === 'NF-e' ? 'Venda NF-e' : 'Venda NFC-e', row.valor),
      payments: [{ methodId: 'dinheiro', label: 'Dinheiro', amount: row.valor }],
    }
  })
}

/**
 * Motor mock compartilhado (browser). Fonte única para listar/emitir/enviar
 * enquanto mode=mock — páginas não devem duplicar essa lógica.
 */
class MockFiscalEngine {
  private documents: FiscalDocument[] = createSeedDocuments()
  private seqNfce = 1045
  private seqNfe = 190

  list(filter: FiscalListFilter = {}): FiscalDocument[] {
    const q = (filter.q || '').trim().toLowerCase()
    return this.documents
      .filter((doc) => {
        if (filter.tipo && filter.tipo !== 'Todos' && doc.tipo !== filter.tipo) return false
        if (filter.status && doc.status !== filter.status) return false
        if (!q) return true
        return (
          doc.numero.includes(q) ||
          doc.chave.includes(q) ||
          doc.cliente.toLowerCase().includes(q) ||
          doc.tipo.toLowerCase().includes(q) ||
          (doc.saleRef || '').toLowerCase().includes(q)
        )
      })
      .slice()
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }

  get(idOrChave: string): FiscalDocument | null {
    const key = idOrChave.trim()
    return this.documents.find((d) => d.id === key || d.chave === key) ?? null
  }

  suggestTipo(buyer?: FiscalBuyer): FiscalDocTipo {
    const digits = onlyDigits(buyer?.document || '')
    if (digits.length === 14) return 'NF-e'
    if ((buyer?.ie || '').trim() && digits.length >= 11) return 'NF-e'
    return 'NFC-e'
  }

  emit(request: FiscalEmitRequest): FiscalDocument {
    if (!request.items?.length) {
      throw new Error('Informe ao menos um item para emitir a nota.')
    }

    const tipo = request.tipo || this.suggestTipo(request.buyer)
    const total =
      request.total != null
        ? roundMoney(request.total)
        : roundMoney(request.items.reduce((s, i) => s + i.qty * i.price, 0))

    const numeroInt = tipo === 'NFC-e' ? this.seqNfce++ : this.seqNfe++
    const { emissao, hora, issuedAt } = nowParts()
    const cliente =
      request.buyer?.name?.trim() ||
      request.buyer?.customerCode?.trim() ||
      (tipo === 'NFC-e' ? 'Consumidor final' : 'Destinatário não informado')

    const payments: FiscalPaymentLine[] = request.payments.map((p) => ({ ...p }))
    const doc: FiscalDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo,
      numero: pad(numeroInt, 6),
      serie: FISCAL_CONFIG.series[tipo],
      chave: buildChave(tipo, numeroInt),
      emissao,
      hora,
      valor: total,
      cliente,
      status: 'authorized',
      saleRef: request.saleRef,
      issuedAt,
      protocol: `135${pad(numeroInt, 12)}`,
      buyerDocument: request.buyer?.document || undefined,
      buyerEmail: request.buyer?.email || undefined,
      items: request.items.map((i) => ({ ...i })),
      payments,
      xml: `<!-- XML mock ${tipo} ${pad(numeroInt, 6)} -->`,
      error: null,
    }

    this.documents.unshift(doc)
    return doc
  }

  markSent(doc: FiscalDocument, sentTo: string): FiscalDocument {
    const sentAt = new Date().toISOString()
    const updated: FiscalDocument = { ...doc, sentAt, sentTo }
    this.documents = this.documents.map((d) => (d.id === doc.id ? updated : d))
    return updated
  }
}

export const mockFiscalEngine = new MockFiscalEngine()
