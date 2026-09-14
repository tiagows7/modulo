import { supabase } from '@/lib/supabase'
import { isModoLoja } from '../../config/pdvConfig'

export type ProdutoVenda = {
  id: string
  codigo: string
  codigo_barras: string | null
  descricao: string
  preco_venda: number
}

/** Filial (UUID) do operador logado no PDV. */
export async function getOperadorFilialId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  const filial = data.user?.user_metadata?.filial
  const id = filial != null ? String(filial).trim() : ''
  return id || null
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

const BLOQUEIO_COMBUSTIVEL_LOJA =
  'Produto do grupo de combustível não está disponível no PDV loja.'

type ProdutoRow = {
  id: string
  codigo: string | null
  codigo_barras: string | null
  descricao: string | null
  grupo_id: string | null
}

async function idsGruposCombustivel(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('grupo_produtos')
    .select('id')
    .eq('combustivel', true)

  if (error) throw error
  return new Set((data ?? []).map((row) => String(row.id)))
}

function ocultarNoPdvLoja(
  grupoId: string | null | undefined,
  gruposCombustivel: Set<string>,
) {
  if (!isModoLoja() || !grupoId) return false
  return gruposCombustivel.has(String(grupoId))
}

async function findProdutoAtivo(codigo: string): Promise<ProdutoRow | null> {
  const selectBase =
    'id, codigo, codigo_barras, descricao, status, grupo_id' as const
  const selectSemBarras = 'id, codigo, descricao, status, grupo_id' as const

  const byCodigo = await supabase
    .from('produtos')
    .select(selectBase)
    .eq('status', 'ativo')
    .eq('codigo', codigo)
    .maybeSingle()

  if (byCodigo.error) {
    const msg = String(byCodigo.error.message || '')
    if (/codigo_barras/i.test(msg)) {
      const retry = await supabase
        .from('produtos')
        .select(selectSemBarras)
        .eq('status', 'ativo')
        .eq('codigo', codigo)
        .maybeSingle()
      if (retry.error) throw retry.error
      if (retry.data) {
        return {
          ...retry.data,
          codigo_barras: null,
          grupo_id:
            retry.data.grupo_id != null ? String(retry.data.grupo_id) : null,
        }
      }
    } else {
      throw byCodigo.error
    }
  } else if (byCodigo.data) {
    return {
      ...byCodigo.data,
      grupo_id:
        byCodigo.data.grupo_id != null ? String(byCodigo.data.grupo_id) : null,
    }
  }

  const byBarras = await supabase
    .from('produtos')
    .select(selectBase)
    .eq('status', 'ativo')
    .eq('codigo_barras', codigo)
    .maybeSingle()

  if (byBarras.error) {
    const msg = String(byBarras.error.message || '')
    if (/codigo_barras/i.test(msg)) return null
    throw byBarras.error
  }
  if (!byBarras.data) return null
  return {
    ...byBarras.data,
    grupo_id:
      byBarras.data.grupo_id != null ? String(byBarras.data.grupo_id) : null,
  }
}

async function precoFilial(
  produtoId: string,
  filialId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('produto_filial')
    .select('valor_venda, situacao')
    .eq('produto', produtoId)
    .eq('filial', filialId)
    .eq('situacao', 'ativo')
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return Number(data.valor_venda) || 0
}

function mapProduto(data: ProdutoRow, precoVenda: number): ProdutoVenda {
  return {
    id: String(data.id),
    codigo: String(data.codigo ?? ''),
    codigo_barras: data.codigo_barras != null ? String(data.codigo_barras) : null,
    descricao: String(data.descricao ?? ''),
    preco_venda: precoVenda,
  }
}

/**
 * Busca produto ativo por código interno ou código de barras,
 * com preço de `produto_filial` da filial do operador.
 */
export async function buscarProdutoPorCodigo(
  code: string,
  filialId?: string | null,
): Promise<ProdutoVenda | null> {
  const codigo = code.trim()
  if (!codigo) return null

  const filial = (filialId ?? (await getOperadorFilialId()))?.trim() || null
  if (!filial) {
    throw new Error(
      'Operador sem filial vinculada. Cadastre a filial no usuário para vender produtos.',
    )
  }

  const produto = await findProdutoAtivo(codigo)
  if (!produto) return null

  if (isModoLoja()) {
    const gruposCombustivel = await idsGruposCombustivel()
    if (ocultarNoPdvLoja(produto.grupo_id, gruposCombustivel)) {
      throw new Error(BLOQUEIO_COMBUSTIVEL_LOJA)
    }
  }

  const preco = await precoFilial(String(produto.id), filial)
  if (preco == null) return null

  return mapProduto(produto, preco)
}

/** Lista produtos ativos liberados na filial do operador (preço por filial). */
export async function listarProdutosAtivos(
  limit = 200,
  filialId?: string | null,
): Promise<ProdutoVenda[]> {
  const filial = (filialId ?? (await getOperadorFilialId()))?.trim() || null
  if (!filial) return []

  const modoLoja = isModoLoja()
  const gruposCombustivel = modoLoja ? await idsGruposCombustivel() : new Set<string>()

  const { data, error } = await supabase
    .from('produto_filial')
    .select(
      `
      valor_venda,
      produtos!inner (
        id,
        codigo,
        codigo_barras,
        descricao,
        status,
        grupo_id
      )
    `,
    )
    .eq('filial', filial)
    .eq('situacao', 'ativo')
    .eq('produtos.status', 'ativo')
    .order('descricao', { referencedTable: 'produtos', ascending: true })
    .limit(modoLoja ? Math.max(limit * 4, 800) : limit)

  if (error) {
    const msg = String(error.message || '')
    // Fallback sem codigo_barras / sem order referenciado
    if (/codigo_barras|referencedTable|order/i.test(msg)) {
      return listarProdutosAtivosFallback(filial, limit, gruposCombustivel)
    }
    throw error
  }

  const rows = data ?? []
  return rows
    .map((row) => {
      const p = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
      if (!p) return null
      if (ocultarNoPdvLoja(p.grupo_id, gruposCombustivel)) return null
      return mapProduto(
        {
          id: String(p.id),
          codigo: p.codigo != null ? String(p.codigo) : null,
          codigo_barras:
            p.codigo_barras != null ? String(p.codigo_barras) : null,
          descricao: p.descricao != null ? String(p.descricao) : null,
          grupo_id: p.grupo_id != null ? String(p.grupo_id) : null,
        },
        Number(row.valor_venda) || 0,
      )
    })
    .filter((x): x is ProdutoVenda => x != null)
    .slice(0, limit)
}

async function listarProdutosAtivosFallback(
  filialId: string,
  limit: number,
  gruposCombustivel = new Set<string>(),
): Promise<ProdutoVenda[]> {
  const { data: pfRows, error: pfError } = await supabase
    .from('produto_filial')
    .select('produto, valor_venda')
    .eq('filial', filialId)
    .eq('situacao', 'ativo')
    .limit(limit)

  if (pfError) throw pfError
  if (!pfRows?.length) return []

  const ids = pfRows.map((r) => String(r.produto))
  const precoById = new Map(
    pfRows.map((r) => [String(r.produto), Number(r.valor_venda) || 0]),
  )

  const { data: produtos, error: prodError } = await supabase
    .from('produtos')
    .select('id, codigo, descricao, status, grupo_id')
    .eq('status', 'ativo')
    .in('id', ids)
    .order('descricao', { ascending: true })

  if (prodError) throw prodError

  return (produtos ?? [])
    .filter((p) => !ocultarNoPdvLoja(p.grupo_id, gruposCombustivel))
    .map((p) =>
      mapProduto(
        {
          id: String(p.id),
          codigo: p.codigo != null ? String(p.codigo) : null,
          codigo_barras: null,
          descricao: p.descricao != null ? String(p.descricao) : null,
          grupo_id: p.grupo_id != null ? String(p.grupo_id) : null,
        },
        precoById.get(String(p.id)) ?? 0,
      ),
    )
}
