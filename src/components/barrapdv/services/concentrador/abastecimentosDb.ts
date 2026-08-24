/**
 * Persistência de abastecimentos no Supabase (grid PDV).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CbcSupplyPayload, TempFilling } from './types'
import { fuels } from '../../data/mock'
import { PRODUCT_MAP, NOZZLE_FUEL_MAP } from './productMaps'

export type CaixaAberto = {
  codigo: number
  data: string
  turno: string | null
  operador: string | null
}

export type AbastecimentoRow = {
  id: number
  bico: string
  numero: number
  litros: number
  preco: number
  valor: number
  aba: number | null
  operador: string | null
  operador_nome: string | null
  produto: string | null
  produto_codigo: number | null
  hora: string | null
  situacao: number
  data: string | null
  medicao: number | null
  caixa_operador: string | null
  caixa_data: string | null
  caixa_turno: string | null
  caixa_codigo: number | null
  documento: string | null
  cupom: string | null
}

let client: SupabaseClient | null = null

function getClient() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado')
  client = createClient(url, key)
  return client
}

function brDateToIso(dateBr: string): string {
  const parts = dateBr.split(/[/\-.]/)
  if (parts.length >= 3) {
    const dd = parts[0].padStart(2, '0')
    const mm = parts[1].padStart(2, '0')
    const yyyy = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
    return `${yyyy}-${mm}-${dd}`
  }
  return new Date().toISOString().slice(0, 10)
}

function isoDateToBr(iso: string | null | undefined): string {
  if (!iso) return new Date().toLocaleDateString('pt-BR')
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function timeFromHora(hora: string | null | undefined, fallback: string): string {
  if (!hora) return fallback
  const d = new Date(hora)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  if (/^\d{2}:\d{2}/.test(hora)) return hora.slice(0, 5)
  return fallback
}

function combineDateTime(dateBr: string, timeHm: string): string {
  const isoDate = brDateToIso(dateBr)
  const [hh = '00', mm = '00'] = timeHm.split(':')
  return `${isoDate}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:00`
}

function bicoFromPayload(p: CbcSupplyPayload): string {
  const extra = p as CbcSupplyPayload & { bicoCode?: string }
  if (extra.bicoCode) return String(extra.bicoCode).padStart(2, '0').toUpperCase()
  return String(p.nozzle).padStart(2, '0')
}

function numeroFromPayload(p: CbcSupplyPayload): number {
  const n = Number.parseInt(String(p.supplyId).replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  // fallback estável a partir do id
  let hash = 0
  for (const ch of p.supplyId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 900000) + 100000
}

export async function getCaixaAberto(): Promise<CaixaAberto | null> {
  const sb = getClient()
  const lim = new Date()
  lim.setDate(lim.getDate() - 10)
  const { data, error } = await sb
    .from('caixa')
    .select('codigo,data,turno,operador')
    .eq('situacao', 0)
    .gte('data', lim.toISOString().slice(0, 10))
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    codigo: Number(data.codigo),
    data: String(data.data),
    turno: data.turno != null ? String(data.turno) : null,
    operador: data.operador != null ? String(data.operador) : null,
  }
}

/** Lista abertos (situacao=0) para o grid. */
export async function listAbastecimentosAbertos(): Promise<AbastecimentoRow[]> {
  const sb = getClient()
  const { data, error } = await sb
    .from('abastecimentos')
    .select('*')
    .eq('situacao', 0)
    .order('hora', { ascending: true, nullsFirst: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as AbastecimentoRow[]
}

export function rowToTempFilling(row: AbastecimentoRow): TempFilling {
  const nozzle = Number.parseInt(String(row.bico), 16)
  const nozzleDec = Number.isFinite(nozzle) && nozzle > 0 ? nozzle : Number(row.bico) || 0
  const productCode = String(row.produto_codigo ?? row.bico ?? '').padStart(2, '0')
  const fuelId =
    PRODUCT_MAP[productCode] ??
    NOZZLE_FUEL_MAP[nozzleDec] ??
    'gc'
  const dateBr = isoDateToBr(row.data)
  const time = timeFromHora(row.hora, '00:00')
  return {
    id: `cbc-${row.bico}-${row.numero}`,
    dbId: row.id,
    nozzle: nozzleDec,
    fuelId,
    cbcProductCode: productCode,
    quantity: Number(row.litros ?? 0),
    unitPrice: Number(row.preco ?? 0),
    total: Number(row.valor ?? 0),
    date: dateBr,
    time,
    operator: String(row.operador_nome || row.operador || row.caixa_operador || ''),
    status: 'disponivel',
    situacao: row.situacao === 1 ? 1 : 0,
    cbcSupplyId: String(row.numero),
    source: 'companytec-cbc',
    receivedAt: row.hora || new Date().toISOString(),
    medicao: row.medicao != null ? Number(row.medicao) : null,
    caixaCodigo: row.caixa_codigo,
    caixaData: row.caixa_data,
    caixaTurno: row.caixa_turno,
    caixaOperador: row.caixa_operador,
    documento: row.documento,
    cupom: row.cupom,
  }
}

/**
 * Grava abastecimentos vindos do CBC (upsert por bico+numero).
 * Não reabre registros já baixados (situacao=1).
 */
export async function upsertFromCbcSupplies(
  supplies: CbcSupplyPayload[],
  opts: { defaultOperator: string },
): Promise<void> {
  if (!supplies.length) return
  const sb = getClient()
  const caixa = await getCaixaAberto()

  for (const p of supplies) {
    if (p.status === 'abastecendo') continue
    const extra = p as CbcSupplyPayload & {
      date?: string
      time?: string
      medicao?: number | null
      bicoCode?: string
    }
    const bico = bicoFromPayload(p)
    const numero = numeroFromPayload(p)
    const dateBr =
      extra.date || new Date().toLocaleDateString('pt-BR')
    const timeHm =
      extra.time ||
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const isoDate = brDateToIso(dateBr)
    const horaIso = combineDateTime(dateBr, timeHm)
    const fuelId =
      PRODUCT_MAP[p.productCode] ?? NOZZLE_FUEL_MAP[p.nozzle] ?? 'gc'
    const fuel = fuels.find((f) => f.id === fuelId)
    const unitPrice = p.unitPrice || fuel?.price || 0
    const total = p.total || Number((p.liters * unitPrice).toFixed(2))

    const { data: existing } = await sb
      .from('abastecimentos')
      .select('id,situacao')
      .eq('bico', bico)
      .eq('numero', numero)
      .maybeSingle()

    if (existing?.situacao === 1) continue

    const payload = {
      bico,
      numero,
      litros: p.liters,
      preco: unitPrice,
      valor: total,
      aba: p.nozzle,
      operador: caixa?.operador || opts.defaultOperator,
      operador_nome: opts.defaultOperator,
      produto: fuel?.name ?? null,
      produto_codigo: fuel?.productCode ?? null,
      hora: horaIso,
      data: isoDate,
      medicao: extra.medicao ?? null,
      situacao: 0,
      caixa_operador: caixa?.operador ?? opts.defaultOperator,
      caixa_data: caixa?.data ?? isoDate,
      caixa_turno: caixa?.turno ?? null,
      caixa_codigo: caixa?.codigo ?? null,
    }

    if (existing?.id) {
      const { error } = await sb
        .from('abastecimentos')
        .update(payload)
        .eq('id', existing.id)
      if (error) console.warn('[abastecimentos] update', error.message)
    } else {
      const { error } = await sb.from('abastecimentos').insert(payload)
      if (error) console.warn('[abastecimentos] insert', error.message)
    }
  }
}

export async function markAbastecimentoUsado(tempId: string): Promise<void> {
  const parsed = parseTempId(tempId)
  if (!parsed) return
  const sb = getClient()
  const { error } = await sb
    .from('abastecimentos')
    .update({ situacao: 1, baixado: 1, selecionado_app: null })
    .eq('bico', parsed.bico)
    .eq('numero', parsed.numero)
    .eq('situacao', 0)
  if (error) throw new Error(error.message)
}

export async function reabrirAbastecimentosDb(tempIds: string[]): Promise<void> {
  const sb = getClient()
  for (const id of tempIds) {
    const parsed = parseTempId(id)
    if (!parsed) continue
    const { error } = await sb
      .from('abastecimentos')
      .update({
        situacao: 0,
        baixado: null,
        selecionado_app: null,
        documento: null,
        cupom: null,
      })
      .eq('bico', parsed.bico)
      .eq('numero', parsed.numero)
    if (error) console.warn('[abastecimentos] reabrir', error.message)
  }
}

export async function setDocumentoCupom(
  tempIds: string[],
  opts: { documento: string; cupom: string },
): Promise<void> {
  const sb = getClient()
  for (const id of tempIds) {
    const parsed = parseTempId(id)
    if (!parsed) continue
    const { error } = await sb
      .from('abastecimentos')
      .update({
        documento: opts.documento,
        cupom: opts.cupom,
        situacao: 1,
        baixado: 1,
      })
      .eq('bico', parsed.bico)
      .eq('numero', parsed.numero)
    if (error) console.warn('[abastecimentos] documento/cupom', error.message)
  }
}

function parseTempId(tempId: string): { bico: string; numero: number } | null {
  // cbc-{bico}-{numero}
  const m = /^cbc-([0-9A-Fa-f]+)-(\d+)$/.exec(tempId)
  if (!m) return null
  return { bico: m[1].toUpperCase().padStart(2, '0'), numero: Number(m[2]) }
}
