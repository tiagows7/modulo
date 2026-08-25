import { supabase } from '@/lib/supabase'

export type ProdutoVenda = {
  id: string
  codigo: string
  codigo_barras: string | null
  descricao: string
  preco_venda: number
}

/** Interpreta quantidade prefixada: `2*789` ou `2.789` (antes de * ou . = qtd). */
export function parseCodigoQuantidade(raw: string): { qty: number; code: string } {
  const s = raw.trim()
  if (!s) return { qty: 1, code: '' }

  const star = s.indexOf('*')
  if (star > 0) {
    const left = s.slice(0, star).trim().replace(',', '.')
    const right = s.slice(star + 1).trim()
    const qty = Number(left)
    if (Number.isFinite(qty) && qty > 0 && right) {
      return { qty, code: right }
    }
  }

  const dot = s.indexOf('.')
  if (dot > 0) {
    const left = s.slice(0, dot).trim()
    const right = s.slice(dot + 1).trim()
    // Só trata como qtd se a parte antes do ponto for inteiro (ex.: 2.789123)
    if (/^\d+$/.test(left) && right) {
      const qty = Number(left)
      if (Number.isFinite(qty) && qty > 0) {
        return { qty, code: right }
      }
    }
  }

  return { qty: 1, code: s }
}

/** Busca produto ativo por código interno ou código de barras. */
export async function buscarProdutoPorCodigo(
  code: string,
): Promise<ProdutoVenda | null> {
  const codigo = code.trim()
  if (!codigo) return null

  const select =
    'id, codigo, codigo_barras, descricao, preco_venda, status' as const

  const byCodigo = await supabase
    .from('produtos')
    .select(select)
    .eq('status', 'ativo')
    .eq('codigo', codigo)
    .maybeSingle()

  if (byCodigo.error) throw byCodigo.error
  if (byCodigo.data) {
    return mapProduto(byCodigo.data)
  }

  const byBarras = await supabase
    .from('produtos')
    .select(select)
    .eq('status', 'ativo')
    .eq('codigo_barras', codigo)
    .maybeSingle()

  // Sem coluna codigo_barras ainda: ignora e retorna não encontrado pelo barras
  if (byBarras.error) {
    const msg = String(byBarras.error.message || '')
    if (/codigo_barras/i.test(msg)) return null
    throw byBarras.error
  }
  if (!byBarras.data) return null

  return mapProduto(byBarras.data)
}

function mapProduto(data: {
  id: string
  codigo: string | null
  codigo_barras: string | null
  descricao: string | null
  preco_venda: number | null
}): ProdutoVenda {
  return {
    id: String(data.id),
    codigo: String(data.codigo ?? ''),
    codigo_barras: data.codigo_barras != null ? String(data.codigo_barras) : null,
    descricao: String(data.descricao ?? ''),
    preco_venda: Number(data.preco_venda) || 0,
  }
}

export async function listarProdutosAtivos(limit = 200): Promise<ProdutoVenda[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('id, codigo, codigo_barras, descricao, preco_venda, status')
    .eq('status', 'ativo')
    .order('descricao', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    codigo: String(row.codigo ?? ''),
    codigo_barras: row.codigo_barras != null ? String(row.codigo_barras) : null,
    descricao: String(row.descricao ?? ''),
    preco_venda: Number(row.preco_venda) || 0,
  }))
}
