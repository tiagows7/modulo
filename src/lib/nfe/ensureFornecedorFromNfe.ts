import type { NfeXmlParsed } from '@/lib/nfe/parseNfeXml'
import { supabase } from '@/lib/supabase'

function onlyDigits(v: string) {
  return String(v || '').replace(/\D/g, '')
}

function formatCnpj(digits: string) {
  const d = onlyDigits(digits)
  if (d.length !== 14) return d || null
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

async function nextCodigoFornecedor() {
  const { data } = await supabase
    .from('fornecedores')
    .select('codigo')
    .order('created_at', { ascending: false })
    .limit(80)

  let max = 0
  for (const row of data ?? []) {
    const match = String(row.codigo ?? '').match(/(\d+)/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `FOR-${String(max + 1).padStart(3, '0')}`
}

export type EnsureFornecedorResult = {
  id: string
  criado: boolean
  nome: string
  codigo: string | null
}

/**
 * Localiza fornecedor pelo CNPJ do XML; se não existir, cadastra automaticamente.
 */
export async function ensureFornecedorFromNfe(
  parsed: NfeXmlParsed,
): Promise<EnsureFornecedorResult | null> {
  const cnpj = onlyDigits(parsed.emit_cnpj || '')
  if (cnpj.length !== 14) {
    // Sem CNPJ válido não dá para auto-cadastrar com unicidade
    return null
  }

  const { data: existentes, error: listErr } = await supabase
    .from('fornecedores')
    .select('id, codigo, razao_social, cnpj, status')

  if (listErr) throw new Error(listErr.message)

  const found = (existentes ?? []).find(
    (f) => onlyDigits(String(f.cnpj || '')) === cnpj,
  )
  if (found) {
    return {
      id: String(found.id),
      criado: false,
      nome: String(found.razao_social || parsed.emit_nome || 'Fornecedor'),
      codigo: found.codigo != null ? String(found.codigo) : null,
    }
  }

  const codigo = await nextCodigoFornecedor()
  const razao =
    (parsed.emit_nome || '').trim() ||
    `Fornecedor ${formatCnpj(cnpj)}`
  const fantasia = (parsed.emit_fantasia || '').trim() || null

  const insertPayload = {
    codigo,
    razao_social: razao.slice(0, 255),
    fantasia: fantasia ? fantasia.slice(0, 255) : null,
    cnpj: formatCnpj(cnpj),
    cpf: null as string | null,
    inscricao_estadual: parsed.emit_ie
      ? String(parsed.emit_ie).slice(0, 30)
      : null,
    cep: parsed.emit_cep ? String(parsed.emit_cep).slice(0, 12) : null,
    endereco: parsed.emit_endereco
      ? String(parsed.emit_endereco).slice(0, 255)
      : null,
    numero: parsed.emit_numero
      ? String(parsed.emit_numero).slice(0, 30)
      : null,
    bairro: parsed.emit_bairro
      ? String(parsed.emit_bairro).slice(0, 120)
      : null,
    uf: parsed.emit_uf ? String(parsed.emit_uf).slice(0, 2).toUpperCase() : null,
    telefone1: parsed.emit_fone
      ? String(parsed.emit_fone).slice(0, 20)
      : null,
    cidade: parsed.emit_cmun ? Number(parsed.emit_cmun) || null : null,
    status: 'ativo',
  }

  const { data: created, error: insErr } = await supabase
    .from('fornecedores')
    .insert(insertPayload)
    .select('id, codigo, razao_social')
    .single()

  if (insErr) {
    // Corrida: outro processo pode ter inserido o mesmo CNPJ
    if (/duplicate|unique|cnpj/i.test(insErr.message)) {
      const { data: again } = await supabase
        .from('fornecedores')
        .select('id, codigo, razao_social, cnpj')
      const retry = (again ?? []).find(
        (f) => onlyDigits(String(f.cnpj || '')) === cnpj,
      )
      if (retry) {
        return {
          id: String(retry.id),
          criado: false,
          nome: String(retry.razao_social || razao),
          codigo: retry.codigo != null ? String(retry.codigo) : null,
        }
      }
    }
    throw new Error(insErr.message)
  }

  return {
    id: String(created.id),
    criado: true,
    nome: String(created.razao_social || razao),
    codigo: created.codigo != null ? String(created.codigo) : codigo,
  }
}
