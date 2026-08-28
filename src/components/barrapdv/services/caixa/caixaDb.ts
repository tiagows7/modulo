/**
 * Status do caixa PDV (public.caixa).
 * situacao: 0 = aberto no PDV, 1 = operador fechou no PDV
 * fechado: true = conferido/fechado na retaguarda (independente de situacao)
 * pdv: identificação do terminal/PDV (múltiplos PDVs por filial)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PDV_STORAGE_KEY = 'pdv_numero'

export type CaixaRow = {
  id: number
  codigo: number
  data: string
  turno: string | null
  operador: string | null
  situacao: number
  filial: string | null
  sobra_falta: number | null
  fechado: boolean
  pdv: string | null
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

/** Código do PDV local (localStorage / env). Default "1". */
export function getPdvCodigo(): string {
  const fromEnv =
    typeof process !== 'undefined'
      ? String(process.env.NEXT_PUBLIC_PDV || '').trim()
      : ''
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    try {
      const stored = String(localStorage.getItem(PDV_STORAGE_KEY) || '').trim()
      if (stored) return stored
    } catch {
      /* ignore */
    }
  }
  return '1'
}

export function setPdvCodigo(pdv: string) {
  const value = String(pdv || '').trim() || '1'
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PDV_STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

/** Último caixa gerado deste PDV (maior id / mais recente). */
export async function getUltimoCaixa(
  pdv: string = getPdvCodigo(),
): Promise<CaixaRow | null> {
  const sb = getClient()
  let q = sb
    .from('caixa')
    .select(
      'id,codigo,data,turno,operador,situacao,filial,sobra_falta,fechado,pdv',
    )
    .order('id', { ascending: false })
    .limit(1)

  const pdvCode = String(pdv || '').trim()
  if (pdvCode) {
    q = q.eq('pdv', pdvCode)
  }

  const { data, error } = await q.maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return mapCaixaRow(data as Record<string, unknown>)
}

function mapCaixaRow(data: Record<string, unknown>): CaixaRow {
  return {
    id: Number(data.id),
    codigo: Number(data.codigo),
    data: String(data.data),
    turno: data.turno != null ? String(data.turno) : null,
    operador: data.operador != null ? String(data.operador) : null,
    situacao: Number(data.situacao) === 1 ? 1 : 0,
    filial: data.filial != null ? String(data.filial) : null,
    sobra_falta:
      data.sobra_falta != null && data.sobra_falta !== ''
        ? Number(data.sobra_falta)
        : null,
    fechado: data.fechado === true || data.fechado === 'true',
    pdv: data.pdv != null ? String(data.pdv) : null,
  }
}

/** Caixa aberto no PDV (operador ainda não fechou). Independente de `fechado` na retaguarda. */
export function isCaixaAberto(caixa: CaixaRow | null): boolean {
  return Boolean(caixa && caixa.situacao === 0)
}

async function nextCodigoCaixa(): Promise<number> {
  const sb = getClient()
  const { data } = await sb
    .from('caixa')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = data?.codigo != null ? Number(data.codigo) : 0
  return (Number.isFinite(max) ? max : 0) + 1
}

type AbrirCaixaOpts = {
  operador?: string | null
  turno?: string | null
  filial?: string | null
  pdv?: string | null
}

/** Abre um novo caixa no PDV (situacao = 0, fechado = false). */
export async function abrirNovoCaixa(
  opts: AbrirCaixaOpts = {},
): Promise<CaixaRow> {
  const sb = getClient()
  const codigo = await nextCodigoCaixa()
  const hoje = new Date().toISOString().slice(0, 10)
  const pdv = String(opts.pdv ?? getPdvCodigo()).trim() || '1'

  const payload = {
    codigo,
    data: hoje,
    turno: opts.turno?.trim() || '1',
    operador: opts.operador?.trim() || null,
    filial: opts.filial?.trim() || null,
    pdv,
    situacao: 0,
    fechado: false,
    sobra_falta: null,
  }

  const { data, error } = await sb
    .from('caixa')
    .insert(payload)
    .select(
      'id,codigo,data,turno,operador,situacao,filial,sobra_falta,fechado,pdv',
    )
    .single()

  if (error) throw new Error(error.message)

  return mapCaixaRow(data as Record<string, unknown>)
}
