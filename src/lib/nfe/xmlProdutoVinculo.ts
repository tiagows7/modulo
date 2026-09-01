import type { NfeXmlItem, NfeXmlParsed } from '@/lib/nfe/parseNfeXml'
import { parseNfeXml } from '@/lib/nfe/parseNfeXml'
import { supabase } from '@/lib/supabase'

export type XmlProdutoVinculo = {
  id: string
  fornecedor: string | null
  produto_xml: string
  produto_sistema: string
  volume: number
  volume2: number
}

export type ItemComVinculo = NfeXmlItem & {
  produto_sistema: string | null
  vinculado: boolean
  volume: number
  volume2: number
}

/** Busca vínculos por fornecedor + produto_xml (cProd). */
export async function listarVinculosXml(
  fornecedorId: string | null,
  codigosXml: string[],
): Promise<Map<string, XmlProdutoVinculo>> {
  const map = new Map<string, XmlProdutoVinculo>()
  const codes = [...new Set(codigosXml.map((c) => c.trim()).filter(Boolean))]
  if (!codes.length) return map

  let q = supabase
    .from('nota_xmlproduto')
    .select('id, fornecedor, produto_xml, produto_sistema, volume, volume2')
    .in('produto_xml', codes)

  if (fornecedorId) {
    q = q.eq('fornecedor', fornecedorId)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const key = String(row.produto_xml || '').trim()
    if (!key) continue
    map.set(key, {
      id: String(row.id),
      fornecedor: row.fornecedor != null ? String(row.fornecedor) : null,
      produto_xml: key,
      produto_sistema: String(row.produto_sistema),
      volume: Number(row.volume) || 0,
      volume2: Number(row.volume2) || 0,
    })
  }

  // Fallback: mesmo cProd sem filtro de fornecedor (quando cadastro antigo)
  if (fornecedorId) {
    const missing = codes.filter((c) => !map.has(c))
    if (missing.length) {
      const { data: extra } = await supabase
        .from('nota_xmlproduto')
        .select('id, fornecedor, produto_xml, produto_sistema, volume, volume2')
        .in('produto_xml', missing)
        .is('fornecedor', null)
      for (const row of extra ?? []) {
        const key = String(row.produto_xml || '').trim()
        if (!key || map.has(key)) continue
        map.set(key, {
          id: String(row.id),
          fornecedor: null,
          produto_xml: key,
          produto_sistema: String(row.produto_sistema),
          volume: Number(row.volume) || 0,
          volume2: Number(row.volume2) || 0,
        })
      }
    }
  }

  return map
}

export function aplicarVinculos(
  itens: NfeXmlItem[],
  vinculos: Map<string, XmlProdutoVinculo>,
): ItemComVinculo[] {
  return itens.map((item) => {
    const v = vinculos.get(item.c_prod.trim())
    return {
      ...item,
      produto_sistema: v?.produto_sistema ?? null,
      vinculado: Boolean(v?.produto_sistema),
      volume: v?.volume ?? 0,
      volume2: v?.volume2 ?? 0,
    }
  })
}

export async function classificarItensXml(
  parsed: NfeXmlParsed,
  fornecedorId: string | null,
): Promise<{ mapeados: ItemComVinculo[]; pendentes: ItemComVinculo[] }> {
  const vinculos = await listarVinculosXml(
    fornecedorId,
    parsed.itens.map((i) => i.c_prod),
  )
  const all = aplicarVinculos(parsed.itens, vinculos)
  return {
    mapeados: all.filter((i) => i.vinculado),
    pendentes: all.filter((i) => !i.vinculado),
  }
}

export function parseXmlConteudo(xml: string | null | undefined): NfeXmlParsed | null {
  if (!xml?.trim()) return null
  return parseNfeXml(xml)
}

export type VinculoSaveRow = {
  fornecedor: string | null
  fornecedor_xml: string | null
  produto_xml: string
  produto_sistema: string
  volume: number
  volume2: number
  codigobarras_xml: string | null
  ncm_xml: string | null
  cest_xml: string | null
  anp_xml: string | null
  cst_xml: string | null
  piscofins_xml: string | null
  cfop_xml: string | null
  codigobeneficio_xml: string | null
  unidade_xml: string | null
  percentualicm_xml: number
  cstibscbs_xml: number | null
  classtrib_xml: string | null
}

/**
 * Fator de conversão do vínculo XML → estoque.
 * volume/volume2 zerados = 1 (não multiplica).
 * Ex.: qtd 1 caixa × volume 24 = 24 un; cigarro pode usar volume × volume2.
 */
export function fatorVolumeVinculo(
  volume: number | null | undefined,
  volume2: number | null | undefined,
): number {
  const v1 = Number(volume) > 0 ? Number(volume) : 1
  const v2 = Number(volume2) > 0 ? Number(volume2) : 1
  return v1 * v2
}

export function itemToVinculoPayload(
  item: NfeXmlItem,
  produtoSistemaId: string,
  fornecedorId: string | null,
  volumes?: { volume?: number; volume2?: number },
): VinculoSaveRow {
  return {
    fornecedor: fornecedorId,
    fornecedor_xml: item.c_prod.slice(0, 30) || null,
    produto_xml: item.c_prod.slice(0, 100),
    produto_sistema: produtoSistemaId,
    // Usuário informa na tela de vínculo (padrão 0). Não usar q_com/q_trib.
    volume: Number(volumes?.volume) > 0 ? Number(volumes?.volume) : 0,
    volume2: Number(volumes?.volume2) > 0 ? Number(volumes?.volume2) : 0,
    codigobarras_xml: item.c_ean ? item.c_ean.slice(0, 20) : null,
    ncm_xml: item.ncm ? item.ncm.slice(0, 20) : null,
    cest_xml: item.cest ? item.cest.slice(0, 20) : null,
    anp_xml: item.c_prod_anp ? item.c_prod_anp.slice(0, 20) : null,
    cst_xml: item.cst_icms ? item.cst_icms.slice(0, 20) : null,
    piscofins_xml: (item.cst_pis || item.cst_cofins || '').slice(0, 20) || null,
    cfop_xml: item.cfop ? item.cfop.slice(0, 20) : null,
    codigobeneficio_xml: item.cbenef ? item.cbenef.slice(0, 20) : null,
    unidade_xml: item.u_com ? item.u_com.slice(0, 20) : null,
    percentualicm_xml: item.p_icms || 0,
    cstibscbs_xml: item.cst_ibscbs,
    classtrib_xml: item.classtrib ? item.classtrib.slice(0, 6) : null,
  }
}
