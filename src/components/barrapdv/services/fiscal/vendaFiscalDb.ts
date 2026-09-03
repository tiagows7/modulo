import { supabase } from '@/lib/supabase'
import {
  montarReceitasFromPayments,
  type ReceitaFiscalLinha,
} from '@/lib/nfe/transmissao'
import { normalizeAmbienteFiscal } from '@/lib/filialAmbienteFiscal'
import type { CartItem } from '../../data/mock'
import { getUltimoCaixa } from '../caixa/caixaDb'
import { getOperadorFilialId } from '../produtos/buscarProduto'
import type {
  FiscalDocStatus,
  FiscalDocTipo,
  FiscalDocument,
  FiscalListFilter,
  FiscalPaymentLine,
} from './types'

type VendaHeaderRow = {
  id: string
  filial: string | null
  pdv: string | null
  cliente: string | null
  operador: string | null
  sale_ref: string | null
  chave: string | null
  numero: number
  serie: string
  modelo: string
  data_emissao: string | null
  hora_emissao: string | null
  dest_documento: string | null
  dest_nome: string | null
  dest_email: string | null
  v_nf: number | string | null
  pagamentos: FiscalPaymentLine[] | null
  protocolo: string | null
  protocolo_cancelamento: string | null
  data_cancelamento: string | null
  motivo_cancelamento: string | null
  xml_nfce?: string | null
  xml_nfe?: string | null
  situacao: string
  erro: string | null
  created_at: string
}

type VendaItemRow = {
  id: string
  n_item: number
  produto: string | null
  kind: string | null
  pump_id: string | null
  c_prod: string | null
  x_prod: string
  u_com: string | null
  q_com: number | string
  v_un_com: number | string
  v_desc: number | string | null
  cupom_codigo: string | null
  cupom_tipo: string | null
  cupom_valor: number | string | null
}

const SITUACAO_TO_STATUS: Record<string, FiscalDocStatus> = {
  pendente: 'pending',
  autorizada: 'authorized',
  denegada: 'denied',
  contingencia: 'contingency',
  cancelada: 'cancelled',
  erro: 'error',
}

const STATUS_TO_SITUACAO: Record<FiscalDocStatus, string> = {
  pending: 'pendente',
  authorized: 'autorizada',
  denied: 'denegada',
  contingency: 'contingencia',
  cancelled: 'cancelada',
  error: 'erro',
}

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function pad(n: number, size: number) {
  return String(n).padStart(size, '0')
}

function isUuid(value: string | undefined | null): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function formatEmissao(iso: string | null | undefined, horaFallback?: string | null) {
  if (!iso) {
    return { emissao: '', hora: horaFallback?.trim() || '' }
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { emissao: iso.slice(0, 10), hora: horaFallback?.trim() || '' }
  }
  return {
    emissao: d.toLocaleDateString('pt-BR'),
    hora:
      horaFallback?.trim() ||
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function tipoFromModelo(modelo: string | null | undefined, fallback: FiscalDocTipo): FiscalDocTipo {
  if (modelo === '55') return 'NF-e'
  if (modelo === '65') return 'NFC-e'
  return fallback
}

function mapPagamentos(raw: unknown): FiscalPaymentLine[] {
  if (!Array.isArray(raw)) return []
  const out: FiscalPaymentLine[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const row = p as Record<string, unknown>
    const amount = num(row.amount as number | string)
    const methodId = String(row.methodId ?? row.method_id ?? 'outros')
    out.push({
      methodId,
      label: row.label != null ? String(row.label) : undefined,
      amount,
      nsu: row.nsu != null ? String(row.nsu) : undefined,
      authorizationCode:
        row.authorizationCode != null
          ? String(row.authorizationCode)
          : row.authorization_code != null
            ? String(row.authorization_code)
            : undefined,
      brand: row.brand != null ? String(row.brand) : undefined,
    })
  }
  return out
}

function mapItemRow(row: VendaItemRow): CartItem {
  const kind = row.kind === 'combustivel' ? 'combustivel' : 'produto'
  const pumpRaw = row.pump_id
  const pumpId =
    pumpRaw != null && pumpRaw !== '' && Number.isFinite(Number(pumpRaw))
      ? Number(pumpRaw)
      : undefined
  return {
    id: row.produto || row.id,
    name: row.x_prod,
    qty: num(row.q_com),
    price: num(row.v_un_com),
    unit: row.u_com || (kind === 'combustivel' ? 'L' : 'UN'),
    kind,
    pumpId,
    productCode: row.c_prod || undefined,
    discount: num(row.v_desc) || undefined,
    couponCode: row.cupom_codigo || undefined,
    couponType: row.cupom_tipo || undefined,
    couponValue: num(row.cupom_valor) || undefined,
  }
}

function mapHeaderToDocument(
  row: VendaHeaderRow,
  tipo: FiscalDocTipo,
  items: CartItem[] = [],
): FiscalDocument {
  const { emissao, hora } = formatEmissao(row.data_emissao, row.hora_emissao)
  const xml = tipo === 'NFC-e' ? row.xml_nfce || undefined : row.xml_nfe || undefined
  return {
    id: row.id,
    tipo,
    numero: pad(Number(row.numero) || 0, 6),
    serie: String(row.serie || '1'),
    chave: row.chave || '',
    emissao,
    hora,
    valor: num(row.v_nf),
    cliente: row.dest_nome?.trim() || 'Consumidor final',
    status: SITUACAO_TO_STATUS[row.situacao] || 'pending',
    saleRef: row.sale_ref || '',
    issuedAt: row.data_emissao || row.created_at,
    protocol: row.protocolo || undefined,
    buyerDocument: row.dest_documento || undefined,
    buyerEmail: row.dest_email || undefined,
    items,
    payments: mapPagamentos(row.pagamentos),
    xml: xml || undefined,
    error: row.erro,
  }
}

async function loadItems(tipo: FiscalDocTipo, vendaId: string): Promise<CartItem[]> {
  const table = tipo === 'NFC-e' ? 'venda_nfceprodutos' : 'venda_nfeprodutos'
  const fk = tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'
  const { data, error } = await supabase
    .from(table)
    .select(
      'id,n_item,produto,kind,pump_id,c_prod,x_prod,u_com,q_com,v_un_com,v_desc,cupom_codigo,cupom_tipo,cupom_valor',
    )
    .eq(fk, vendaId)
    .order('n_item', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data || []) as VendaItemRow[]).map(mapItemRow)
}

async function resolvePdvId(
  filialId: string | null,
  pdvCodigo: string | null | undefined,
): Promise<string | null> {
  if (!filialId || !pdvCodigo?.trim()) return null
  const { data } = await supabase
    .from('pdvs')
    .select('id')
    .eq('filial', filialId)
    .eq('codigo', pdvCodigo.trim())
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

export async function listVendaFiscalDocuments(
  filter: FiscalListFilter = {},
): Promise<FiscalDocument[]> {
  const filialId = await getOperadorFilialId()
  const q = (filter.q || '').trim()
  const wantNfce = !filter.tipo || filter.tipo === 'Todos' || filter.tipo === 'NFC-e'
  const wantNfe = !filter.tipo || filter.tipo === 'Todos' || filter.tipo === 'NF-e'
  const situacao = filter.status ? STATUS_TO_SITUACAO[filter.status] : null

  const docs: FiscalDocument[] = []

  async function fetchTable(tipo: FiscalDocTipo) {
    const table = tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'
    let query = supabase
      .from(table)
      .select(
        'id,filial,pdv,cliente,operador,sale_ref,chave,numero,serie,modelo,data_emissao,hora_emissao,dest_documento,dest_nome,dest_email,v_nf,pagamentos,protocolo,protocolo_cancelamento,data_cancelamento,motivo_cancelamento,situacao,erro,created_at',
      )
      .order('data_emissao', { ascending: false, nullsFirst: false })
      .limit(200)

    if (filialId) query = query.eq('filial', filialId)
    if (situacao) query = query.eq('situacao', situacao)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    for (const row of (data || []) as VendaHeaderRow[]) {
      const doc = mapHeaderToDocument(row, tipoFromModelo(row.modelo, tipo))
      if (q) {
        const hay = `${doc.numero} ${doc.chave} ${doc.cliente} ${doc.tipo} ${doc.saleRef}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) continue
      }
      docs.push(doc)
    }
  }

  if (wantNfce) await fetchTable('NFC-e')
  if (wantNfe) await fetchTable('NF-e')

  docs.sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''))
  return docs
}

export async function getVendaFiscalDocument(
  idOrChave: string,
): Promise<FiscalDocument | null> {
  const key = idOrChave.trim()
  if (!key) return null

  for (const tipo of ['NFC-e', 'NF-e'] as FiscalDocTipo[]) {
    const table = tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'
    const xmlCol = tipo === 'NFC-e' ? 'xml_nfce' : 'xml_nfe'
    let query = supabase
      .from(table)
      .select(
        `id,filial,pdv,cliente,operador,sale_ref,chave,numero,serie,modelo,data_emissao,hora_emissao,dest_documento,dest_nome,dest_email,v_nf,pagamentos,protocolo,protocolo_cancelamento,data_cancelamento,motivo_cancelamento,${xmlCol},situacao,erro,created_at`,
      )

    if (isUuid(key)) query = query.eq('id', key)
    else query = query.eq('chave', key)

    const { data, error } = await query.maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) continue

    const row = data as VendaHeaderRow
    const items = await loadItems(tipo, row.id)
    return mapHeaderToDocument(row, tipoFromModelo(row.modelo, tipo), items)
  }

  return null
}

export type CancelVendaFiscalInput = {
  documentId: string
  motivo: string
  protocoloCancelamento?: string
}

export async function cancelVendaFiscalDocument(
  input: CancelVendaFiscalInput,
): Promise<FiscalDocument> {
  const motivo = input.motivo.trim()
  if (motivo.length < 15) {
    throw new Error('Informe o motivo do cancelamento (mínimo 15 caracteres).')
  }

  const current = await getVendaFiscalDocument(input.documentId)
  if (!current) throw new Error('Documento não encontrado.')
  if (current.status === 'cancelled') {
    throw new Error(`Documento ${current.tipo} ${current.numero} já está cancelado.`)
  }
  if (current.status !== 'authorized' && current.status !== 'contingency') {
    throw new Error(
      `Só é possível cancelar notas autorizadas (situação atual: ${current.status}).`,
    )
  }

  const table = current.tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'
  const now = new Date().toISOString()
  const protocolo =
    input.protocoloCancelamento?.trim() ||
    `CAN${Date.now().toString().slice(-12)}`

  const { error } = await supabase
    .from(table)
    .update({
      situacao: 'cancelada',
      protocolo_cancelamento: protocolo,
      data_cancelamento: now,
      motivo_cancelamento: motivo,
    })
    .eq('id', current.id)

  if (error) throw new Error(error.message)

  const updated = await getVendaFiscalDocument(current.id)
  if (!updated) throw new Error('Cancelamento gravado, mas falhou ao recarregar o documento.')
  return updated
}

/** Persiste documento autorizado em venda_nfce / venda_nfe (+ itens + receitas). */
export async function saveVendaFiscalDocument(
  doc: FiscalDocument,
  options: { receitas?: ReceitaFiscalLinha[]; ambiente?: 1 | 2 } = {},
): Promise<FiscalDocument> {
  const filialId = await getOperadorFilialId()
  const caixa = await getUltimoCaixa().catch(() => null)
  const pdvCodigo = caixa?.pdv || null
  const pdvId = await resolvePdvId(filialId, pdvCodigo)

  let ambiente = options.ambiente
  if (ambiente == null && filialId) {
    const col = doc.tipo === 'NFC-e' ? 'ambiente_nfce' : 'ambiente_nfe'
    const { data: filialRow } = await supabase
      .from('filial')
      .select(col)
      .eq('id', filialId)
      .maybeSingle()
    const raw = filialRow
      ? (filialRow as Record<string, unknown>)[col]
      : null
    ambiente = normalizeAmbienteFiscal(raw)
  }
  if (ambiente == null) ambiente = 2

  const issued = doc.issuedAt ? new Date(doc.issuedAt) : new Date()
  const hora =
    doc.hora ||
    issued.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const headerBase = {
    filial: filialId,
    pdv: pdvId,
    operador: caixa?.operador || null,
    sale_ref: doc.saleRef || null,
    caixa: null as string | null,
    caixa_codigo: caixa?.codigo != null ? String(caixa.codigo) : null,
    caixa_data: caixa?.data || null,
    caixa_pdv: pdvCodigo,
    caixa_turno: caixa?.turno != null ? Number(caixa.turno) || null : null,
    caixa_operador: caixa?.operador || null,
    chave: doc.chave || null,
    numero: Number(doc.numero) || 0,
    serie: doc.serie || '1',
    modelo: doc.tipo === 'NF-e' ? '55' : '65',
    ambiente,
    data_emissao: issued.toISOString(),
    hora_emissao: hora,
    dest_documento: doc.buyerDocument || null,
    dest_nome: doc.cliente || null,
    dest_email: doc.buyerEmail || null,
    v_prod: doc.valor,
    v_nf: doc.valor,
    pagamentos: doc.payments || [],
    protocolo: doc.protocol || null,
    data_autorizacao: doc.status === 'authorized' ? issued.toISOString() : null,
    situacao: STATUS_TO_SITUACAO[doc.status] || 'autorizada',
    erro: doc.error || null,
  }

  const header =
    doc.tipo === 'NFC-e'
      ? { ...headerBase, xml_nfce: doc.xml || null }
      : { ...headerBase, xml_nfe: doc.xml || null }

  const insertPayload = isUuid(doc.id) ? { ...header, id: doc.id } : header

  const table = doc.tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'
  const itemsTable = doc.tipo === 'NFC-e' ? 'venda_nfceprodutos' : 'venda_nfeprodutos'
  const receitasTable = doc.tipo === 'NFC-e' ? 'receitas_nfce' : 'receitas_nfe'
  const fk = doc.tipo === 'NFC-e' ? 'venda_nfce' : 'venda_nfe'

  const { data: inserted, error } = await supabase
    .from(table)
    .insert(insertPayload as never)
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  const vendaId = String(inserted.id)

  const itemRows = (doc.items || []).map((item, index) => {
    const vProd = Math.round(item.qty * item.price * 100) / 100
    const vDesc = item.discount != null ? num(item.discount) : 0
    const row: Record<string, unknown> = {
      [fk]: vendaId,
      produto: isUuid(item.id) ? item.id : null,
      n_item: index + 1,
      kind: item.kind,
      pump_id: item.pumpId != null ? String(item.pumpId) : null,
      c_prod: item.productCode != null ? String(item.productCode) : null,
      x_prod: item.name,
      u_com: item.unit || (item.kind === 'combustivel' ? 'L' : 'UN'),
      q_com: item.qty,
      v_un_com: item.price,
      v_prod: vProd,
      q_trib: item.qty,
      v_un_trib: item.price,
      v_desc: vDesc,
      v_liquido: Math.round((vProd - vDesc) * 100) / 100,
      cupom_codigo: item.couponCode || null,
      cupom_tipo: item.couponType || null,
      cupom_valor: item.couponValue != null ? num(item.couponValue) : 0,
    }
    return row
  })

  if (itemRows.length) {
    const { error: itemsError } = await supabase
      .from(itemsTable)
      .insert(itemRows as never)
    if (itemsError) throw new Error(itemsError.message)
  }

  const receitas =
    options.receitas ||
    montarReceitasFromPayments(
      (doc.payments || []).map((p) => ({
        methodId: p.methodId,
        label: p.label,
        amount: p.amount,
        isTef: p.isTef,
        nsu: p.nsu,
        authorizationCode: p.authorizationCode,
        brand: p.brand,
        tef: p.tef,
      })),
      doc.saleRef,
    )

  if (receitas.length) {
    const receitaRows = receitas.map((r) => ({
      [fk]: vendaId,
      filial: filialId,
      pdv: pdvId,
      sale_ref: r.sale_ref || doc.saleRef || null,
      caixa_codigo: caixa?.codigo != null ? String(caixa.codigo) : null,
      caixa_data: caixa?.data || null,
      caixa_pdv: pdvCodigo,
      caixa_turno: caixa?.turno != null ? Number(caixa.turno) || null : null,
      caixa_operador: caixa?.operador || null,
      n_item: r.n_item,
      forma_pagamento: r.forma_pagamento,
      method_id: r.method_id,
      label: r.label,
      valor: r.valor,
      situacao: r.situacao || 'aberta',
      campo_131: r.campo_131,
      campo_132: r.campo_132,
      recebimento_cartao: r.recebimento_cartao,
      data_prevista: r.data_prevista,
      modalidade: r.modalidade,
      bin_rede: r.bin_rede,
      data_cartao: r.data_cartao,
      hora_cartao: r.hora_cartao,
      autorizacao: r.autorizacao,
      taxa_cartao: r.taxa_cartao,
      bandeira: r.bandeira,
      nsu: r.nsu,
    }))

    const { error: receitaError } = await supabase
      .from(receitasTable)
      .insert(receitaRows as never)
    if (receitaError) throw new Error(receitaError.message)
  }

  const saved = await getVendaFiscalDocument(vendaId)
  return saved || { ...doc, id: vendaId }
}
