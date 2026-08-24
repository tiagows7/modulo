/**
 * Persistência de abastecimentos no Supabase (grid PDV).
 *
 * - Chegada CBC: grava dados do concentrador + cartao_abastecimento.
 *   Se cartao_abastecimento informado → preenche operador / operador_nome.
 * - Baixa: só então preenche caixa_operador, caixa_data, caixa_turno, caixa_codigo.
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
  cartao_abastecimento: string | null
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
  if (p.bicoCode) return normalizeBicoCode(p.bicoCode)
  return normalizeBicoCode(p.nozzle)
}

/** Normaliza código do bico CBC / cadastro (ex.: 4 → 04). */
function normalizeBicoCode(value: string | number | null | undefined): string {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
  if (!raw) return ''
  if (/^\d+$/.test(raw)) return raw.padStart(2, '0')
  return raw
}

type BicoCadastro = {
  id: string
  numero: string
  filial: string | null
  preco_atual: number | null
  produto_codigo: number | null
  produto_nome: string | null
  produto_preco: number | null
}

/**
 * Índice codigo_concentrador / identificacao_bomba → bico + produto do cadastro.
 */
async function loadBicosCadastroMap(): Promise<Map<string, BicoCadastro>> {
  const sb = getClient()
  const { data, error } = await sb.from('bicos').select(`
      id,
      numero,
      filial,
      preco_atual,
      codigo_concentrador,
      identificacao_bomba,
      produtos ( codigo, descricao, preco_venda )
    `)
  const map = new Map<string, BicoCadastro>()
  if (error) {
    console.warn('[abastecimentos] bicos cadastro:', error.message)
    return map
  }

  for (const row of data ?? []) {
    const prodRaw = row.produtos as
      | { codigo: string; descricao: string; preco_venda: number | null }
      | { codigo: string; descricao: string; preco_venda: number | null }[]
      | null
    const prod = Array.isArray(prodRaw) ? prodRaw[0] ?? null : prodRaw
    const prodCodigoNum = prod?.codigo
      ? Number.parseInt(String(prod.codigo).replace(/\D/g, ''), 10)
      : NaN
    const entry: BicoCadastro = {
      id: String(row.id),
      numero: String(row.numero ?? ''),
      filial: row.filial ? String(row.filial) : null,
      preco_atual:
        row.preco_atual != null ? Number(row.preco_atual) : null,
      produto_codigo: Number.isFinite(prodCodigoNum) ? prodCodigoNum : null,
      produto_nome: prod?.descricao ? String(prod.descricao) : null,
      produto_preco:
        prod?.preco_venda != null ? Number(prod.preco_venda) : null,
    }

    const keys = [
      normalizeBicoCode(row.codigo_concentrador as string | null),
      normalizeBicoCode(row.identificacao_bomba as string | null),
    ].filter(Boolean)

    for (const key of new Set(keys)) {
      map.set(key, entry)
    }
  }
  return map
}

function numeroFromPayload(p: CbcSupplyPayload): number {
  const n = Number.parseInt(String(p.supplyId).replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  let hash = 0
  for (const ch of p.supplyId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 900000) + 100000
}

function normalizeCartao(value: string | null | undefined): string | null {
  if (value == null) return null
  const raw = String(value).trim().toUpperCase()
  if (!raw || /^0+$/.test(raw)) return null
  return raw
}

/** Monta patch de caixa_* a partir do caixa aberto (só na baixa). */
async function caixaFieldsForBaixa(): Promise<{
  caixa_operador: string | null
  caixa_data: string | null
  caixa_turno: string | null
  caixa_codigo: number | null
}> {
  const caixa = await getCaixaAberto()
  if (!caixa) {
    return {
      caixa_operador: null,
      caixa_data: null,
      caixa_turno: null,
      caixa_codigo: null,
    }
  }
  return {
    caixa_operador: caixa.operador,
    caixa_data: caixa.data,
    caixa_turno: caixa.turno,
    caixa_codigo: caixa.codigo,
  }
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
  const productCode = normalizeBicoCode(row.produto_codigo ?? '')
  const fuelId =
    PRODUCT_MAP[productCode] ??
    PRODUCT_MAP[String(row.produto_codigo ?? '').padStart(2, '0')] ??
    NOZZLE_FUEL_MAP[nozzleDec] ??
    'gc'
  const dateBr = isoDateToBr(row.data)
  const time = timeFromHora(row.hora, '00:00')
  const cartao = normalizeCartao(row.cartao_abastecimento)
  return {
    id: `cbc-${row.bico}-${row.numero}`,
    dbId: row.id,
    nozzle: nozzleDec,
    fuelId,
    cbcProductCode: productCode || String(row.produto_codigo ?? ''),
    quantity: Number(row.litros ?? 0),
    unitPrice: Number(row.preco ?? 0),
    total: Number(row.valor ?? 0),
    date: dateBr,
    time,
    operator: String(
      row.operador_nome || row.operador || cartao || '',
    ),
    status: 'disponivel',
    situacao: row.situacao === 1 ? 1 : 0,
    cbcSupplyId: String(row.numero),
    source: 'companytec-cbc',
    receivedAt: row.hora || new Date().toISOString(),
    medicao: row.medicao != null ? Number(row.medicao) : null,
    cartaoAbastecimento: cartao,
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
 * Não preenche caixa_* — isso só ocorre na baixa.
 * Se cartao_abastecimento vier informado → operador / operador_nome.
 */
export async function upsertFromCbcSupplies(
  supplies: CbcSupplyPayload[],
  _opts: { defaultOperator: string },
): Promise<void> {
  if (!supplies.length) return
  const sb = getClient()
  const bicosMap = await loadBicosCadastroMap()

  for (const p of supplies) {
    if (p.status === 'abastecendo') continue
    const bico = bicoFromPayload(p)
    const numero = numeroFromPayload(p)
    const dateBr = p.date || new Date().toLocaleDateString('pt-BR')
    const timeHm =
      p.time ||
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const isoDate = brDateToIso(dateBr)
    const horaIso = combineDateTime(dateBr, timeHm)
    const cartao = normalizeCartao(p.cartaoAbastecimento)

    // Casa código CBC com public.bicos.codigo_concentrador e usa o produto do cadastro.
    const bicoCad = bicosMap.get(bico) ?? null
    const fuelIdFallback =
      PRODUCT_MAP[normalizeBicoCode(p.productCode)] ??
      PRODUCT_MAP[String(p.productCode).padStart(2, '0')] ??
      NOZZLE_FUEL_MAP[p.nozzle] ??
      'gc'
    const fuelFallback = fuels.find((f) => f.id === fuelIdFallback)

    const produtoNome =
      bicoCad?.produto_nome || fuelFallback?.name || null
    const produtoCodigo =
      bicoCad?.produto_codigo ?? fuelFallback?.productCode ?? null
    const unitPrice =
      p.unitPrice ||
      bicoCad?.preco_atual ||
      bicoCad?.produto_preco ||
      fuelFallback?.price ||
      0
    const total = p.total || Number((p.liters * unitPrice).toFixed(2))

    if (!bicoCad) {
      console.warn(
        `[abastecimentos] bico concentrador "${bico}" sem cadastro em bicos.codigo_concentrador`,
      )
    } else if (!bicoCad.produto_nome) {
      console.warn(
        `[abastecimentos] bico concentrador "${bico}" cadastrado sem produto vinculado`,
      )
    }

    const { data: existing } = await sb
      .from('abastecimentos')
      .select('id,situacao')
      .eq('bico', bico)
      .eq('numero', numero)
      .maybeSingle()

    if (existing?.situacao === 1) continue

    const payload: Record<string, unknown> = {
      bico,
      numero,
      litros: p.liters,
      preco: unitPrice,
      valor: total,
      aba: p.nozzle,
      produto: produtoNome,
      produto_codigo: produtoCodigo,
      hora: horaIso,
      data: isoDate,
      medicao: p.medicao ?? null,
      cartao_abastecimento: cartao,
      situacao: 0,
      filial: bicoCad?.filial ?? null,
      // caixa_* só na baixa
      caixa_operador: null,
      caixa_data: null,
      caixa_turno: null,
      caixa_codigo: null,
    }

    if (cartao) {
      payload.operador = cartao
      payload.operador_nome = cartao
    } else {
      payload.operador = null
      payload.operador_nome = null
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
  const caixaPatch = await caixaFieldsForBaixa()
  const { error } = await sb
    .from('abastecimentos')
    .update({
      situacao: 1,
      baixado: 1,
      selecionado_app: null,
      ...caixaPatch,
    })
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
        caixa_operador: null,
        caixa_data: null,
        caixa_turno: null,
        caixa_codigo: null,
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
  const caixaPatch = await caixaFieldsForBaixa()
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
        ...caixaPatch,
      })
      .eq('bico', parsed.bico)
      .eq('numero', parsed.numero)
    if (error) console.warn('[abastecimentos] documento/cupom', error.message)
  }
}

function parseTempId(tempId: string): { bico: string; numero: number } | null {
  const m = /^cbc-([0-9A-Fa-f]+)-(\d+)$/.exec(tempId)
  if (!m) return null
  return { bico: m[1].toUpperCase().padStart(2, '0'), numero: Number(m[2]) }
}
