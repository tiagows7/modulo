import type { TempFilling } from './types'

type Listener = (rows: TempFilling[]) => void

const STORAGE_KEY = 'pdv_temp_fillings_cbc'
const CLEAR_FLAG = 'pdv_temp_fillings_cbc_cleared_sim_only'

/** Converte DD/MM/YYYY + HH:MM em timestamp para ordenação. */
function fillingTimestamp(row: TempFilling): number {
  const dateParts = row.date?.split(/[/\-.]/) ?? []
  const timeParts = row.time?.split(':') ?? []
  if (dateParts.length >= 3) {
    const day = Number(dateParts[0])
    const month = Number(dateParts[1])
    const year = Number(dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2])
    const hour = Number(timeParts[0] ?? 0)
    const minute = Number(timeParts[1] ?? 0)
    const second = Number(timeParts[2] ?? 0)
    const ms = Date.UTC(year, month - 1, day, hour, minute, second)
    if (Number.isFinite(ms)) return ms
  }
  const received = Date.parse(row.receivedAt ?? '')
  return Number.isFinite(received) ? received : 0
}

/** Mais antigos primeiro — novos entram embaixo. */
function compareFillingsAsc(a: TempFilling, b: TempFilling): number {
  const diff = fillingTimestamp(a) - fillingTimestamp(b)
  if (diff !== 0) return diff
  return (a.receivedAt ?? '').localeCompare(b.receivedAt ?? '') || a.id.localeCompare(b.id)
}

/**
 * Tabela temporária em memória (+ localStorage).
 * Depois será substituída/persistida no banco de dados.
 */
class TempFillingTable {
  private rows: TempFilling[] = []
  private listeners = new Set<Listener>()

  constructor() {
    this.clearLegacyOnce()
    this.load()
  }

  /** Limpeza única dos dados antigos da simulação */
  private clearLegacyOnce() {
    try {
      if (!localStorage.getItem(CLEAR_FLAG)) {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.setItem(CLEAR_FLAG, '1')
        this.rows = []
      }
    } catch {
      this.rows = []
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Partial<TempFilling>>
        this.rows = parsed.map((r) => this.normalizeRow(r))
      }
    } catch {
      this.rows = []
    }
  }

  /** Garante situacao 0|1 (legado: lancado → 1). */
  private normalizeRow(row: Partial<TempFilling>): TempFilling {
    const status = (row.status ?? 'disponivel') as TempFilling['status']
    const situacao: 0 | 1 =
      row.situacao === 1 || status === 'lancado' ? 1 : 0
    return {
      id: String(row.id ?? ''),
      dbId: row.dbId ?? null,
      nozzle: Number(row.nozzle ?? 0),
      fuelId: String(row.fuelId ?? ''),
      cbcProductCode: String(row.cbcProductCode ?? ''),
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unitPrice ?? 0),
      total: Number(row.total ?? 0),
      date: String(row.date ?? ''),
      time: String(row.time ?? ''),
      operator: String(row.operator ?? ''),
      status,
      situacao,
      cbcSupplyId: String(row.cbcSupplyId ?? ''),
      source: row.source === 'manual' ? 'manual' : 'companytec-cbc',
      receivedAt: String(row.receivedAt ?? new Date().toISOString()),
      medicao: row.medicao ?? null,
      cartaoAbastecimento: row.cartaoAbastecimento ?? null,
      caixaCodigo: row.caixaCodigo ?? null,
      caixaData: row.caixaData ?? null,
      caixaTurno: row.caixaTurno ?? null,
      caixaOperador: row.caixaOperador ?? null,
      documento: row.documento ?? null,
      cupom: row.cupom ?? null,
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.rows))
    } catch {
      // storage cheio / indisponível — mantém só em memória
    }
    this.emit()
  }

  private emit() {
    const snapshot = this.list()
    this.listeners.forEach((fn) => fn(snapshot))
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  list(): TempFilling[] {
    return [...this.rows].sort(compareFillingsAsc)
  }

  /** Só abastecimentos em aberto (situacao = 0). */
  listAbertos(): TempFilling[] {
    return this.list().filter((r) => r.situacao === 0)
  }

  getById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null
  }

  upsert(row: TempFilling) {
    const incoming = this.normalizeRow(row)
    const idx = this.rows.findIndex(
      (r) => r.id === incoming.id || (r.cbcSupplyId && r.cbcSupplyId === incoming.cbcSupplyId),
    )
    if (idx >= 0) {
      const prev = this.rows[idx]
      this.rows[idx] = {
        ...prev,
        ...incoming,
        // Não reabre abastecimento já usado/baixado
        situacao: prev.situacao === 1 ? 1 : incoming.situacao,
        status: prev.situacao === 1 ? 'lancado' : incoming.status,
      }
    } else {
      this.rows.push(incoming)
    }
    this.persist()
  }

  upsertMany(rows: TempFilling[]) {
    rows.forEach((row) => {
      const incoming = this.normalizeRow(row)
      const idx = this.rows.findIndex(
        (r) =>
          r.id === incoming.id || (r.cbcSupplyId && r.cbcSupplyId === incoming.cbcSupplyId),
      )
      if (idx >= 0) {
        const prev = this.rows[idx]
        this.rows[idx] = {
          ...prev,
          ...incoming,
          situacao: prev.situacao === 1 ? 1 : incoming.situacao,
          status: prev.situacao === 1 ? 'lancado' : incoming.status,
        }
      } else {
        this.rows.push(incoming)
      }
    })
    this.persist()
  }

  /** Substitui o cache local pelo snapshot do banco (abertos). */
  replaceAll(rows: TempFilling[]) {
    this.rows = rows.map((r) => this.normalizeRow(r))
    this.persist()
  }

  /** Marca como usado (lançado no cupom ou baixado sem nota). */
  markAsUsado(id: string) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return
    row.situacao = 1
    row.status = 'lancado'
    this.persist()
  }

  /** Volta abastecimento para aberto (ex.: limpar cupom). */
  reabrir(id: string) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return
    row.situacao = 0
    row.status = 'disponivel'
    this.persist()
  }

  reabrirMany(ids: string[]) {
    let changed = false
    for (const id of ids) {
      const row = this.rows.find((r) => r.id === id)
      if (!row || row.situacao === 0) continue
      row.situacao = 0
      row.status = 'disponivel'
      changed = true
    }
    if (changed) this.persist()
  }

  /** @deprecated use markAsUsado */
  markAsLancado(id: string) {
    this.markAsUsado(id)
  }

  remove(id: string) {
    this.rows = this.rows.filter((r) => r.id !== id)
    this.persist()
  }

  clear() {
    this.rows = []
    this.persist()
  }

  countDisponiveis() {
    return this.rows.filter((r) => r.situacao === 0 && r.status === 'disponivel').length
  }
}

export const tempFillingTable = new TempFillingTable()
