/**
 * Status do caixa PDV (public.caixa).
 * situacao: 0 = aberto, 1 = fechado
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type CaixaRow = {
  id: number
  codigo: number
  data: string
  turno: string | null
  operador: string | null
  situacao: number
  filial: string | null
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

/** Último caixa gerado (maior id / mais recente). */
export async function getUltimoCaixa(): Promise<CaixaRow | null> {
  const sb = getClient()
  const { data, error } = await sb
    .from('caixa')
    .select('id,codigo,data,turno,operador,situacao,filial')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: Number(data.id),
    codigo: Number(data.codigo),
    data: String(data.data),
    turno: data.turno != null ? String(data.turno) : null,
    operador: data.operador != null ? String(data.operador) : null,
    situacao: Number(data.situacao) === 1 ? 1 : 0,
    filial: data.filial != null ? String(data.filial) : null,
  }
}

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
}

/** Abre um novo caixa (situacao = 0). */
export async function abrirNovoCaixa(opts: AbrirCaixaOpts = {}): Promise<CaixaRow> {
  const sb = getClient()
  const codigo = await nextCodigoCaixa()
  const hoje = new Date().toISOString().slice(0, 10)

  const payload = {
    codigo,
    data: hoje,
    turno: opts.turno?.trim() || '1',
    operador: opts.operador?.trim() || null,
    filial: opts.filial?.trim() || null,
    situacao: 0,
  }

  const { data, error } = await sb
    .from('caixa')
    .insert(payload)
    .select('id,codigo,data,turno,operador,situacao,filial')
    .single()

  if (error) throw new Error(error.message)

  return {
    id: Number(data.id),
    codigo: Number(data.codigo),
    data: String(data.data),
    turno: data.turno != null ? String(data.turno) : null,
    operador: data.operador != null ? String(data.operador) : null,
    situacao: 0,
    filial: data.filial != null ? String(data.filial) : null,
  }
}
