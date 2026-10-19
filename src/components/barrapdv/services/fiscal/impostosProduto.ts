import { supabase } from '@/lib/supabase'
import type { TransmitItem } from '@/lib/nfe/transmissao'

export type ImpostoProduto = {
  ncm?: string | null
  cfop?: string | null
  csosn?: string | null
  cstIcms?: string | null
  pIcms?: number | null
  pRedBc?: number | null
  cstPis?: string | null
  pPis?: number | null
  cstCofins?: string | null
  pCofins?: number | null
  cstIbscbs?: string | null
  cClassTrib?: string | null
  indGibscbs?: number | null
  indGibscbsMono?: number | null
  indGred?: number | null
  pRedIbs?: number | null
  pRedCbs?: number | null
  pMono?: number | null
  gtin?: string | null
  cest?: string | null
  cProdANP?: string | null
  descANP?: string | null
  pIbptNac?: number | null
  pIbptEst?: number | null
}

/**
 * Carrega NCM, CFOP, ICMS, PIS/COFINS, IBS/CBS, CEST, ANP e IBPT dos produtos.
 * Chave = id do produto (UUID).
 */
export async function carregarImpostosProdutos(
  produtoIds: string[],
): Promise<Map<string, ImpostoProduto>> {
  const ids = [...new Set(produtoIds.map((id) => String(id).trim()).filter(Boolean))]
  const map = new Map<string, ImpostoProduto>()
  if (!ids.length) return map

  const { data, error } = await supabase
    .from('produtos')
    .select(
      `
      id,
      codigo_barras,
      aliquota_monofasica,
      produto_ncm ( ibpt_ncm, ibpt_aliq_nac, ibpt_aliq_est ),
      produto_cfop ( codigo ),
      produto_cest ( codigo ),
      produto_anp ( codigo, descricao ),
      categorias_icm (
        csosn,
        cst_icms,
        aliquota_estado,
        percentual_reduzido,
        cfop_estado
      ),
      produto_piscofins (
        codigo,
        percentual_pis,
        percentual_cofins
      ),
      produto_ibscbs_cst (
        cst,
        ind_gibscbs,
        ind_gibscbsmono,
        ind_gred
      ),
      produto_ibscbs_classtrib (
        codigo,
        red_ibs,
        red_cbs
      )
    `,
    )
    .in('id', ids)

  if (error) throw error

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const ncmRel = one(r.produto_ncm as Record<string, unknown> | null)
    const cfopRel = one(r.produto_cfop as Record<string, unknown> | null)
    const cestRel = one(r.produto_cest as Record<string, unknown> | null)
    const anpRel = one(r.produto_anp as Record<string, unknown> | null)
    const icm = one(r.categorias_icm as Record<string, unknown> | null)
    const pis = one(r.produto_piscofins as Record<string, unknown> | null)
    const ibsCst = one(r.produto_ibscbs_cst as Record<string, unknown> | null)
    const ibsClass = one(
      r.produto_ibscbs_classtrib as Record<string, unknown> | null,
    )

    const ncm =
      ncmRel?.ibpt_ncm != null ? String(ncmRel.ibpt_ncm).replace(/\D/g, '') : null
    const cfopProd =
      cfopRel?.codigo != null ? String(cfopRel.codigo).replace(/\D/g, '') : null
    const cfopCat =
      icm?.cfop_estado != null ? String(icm.cfop_estado).replace(/\D/g, '') : null
    const cest =
      cestRel?.codigo != null
        ? String(cestRel.codigo).replace(/\D/g, '').slice(0, 7)
        : null
    const cProdANP =
      anpRel?.codigo != null
        ? String(anpRel.codigo).replace(/\D/g, '').slice(0, 9)
        : null
    const gtin =
      r.codigo_barras != null
        ? String(r.codigo_barras).replace(/\D/g, '')
        : null

    map.set(String(r.id), {
      ncm: ncm || null,
      cfop: cfopProd || cfopCat || null,
      csosn: icm?.csosn != null ? String(icm.csosn).replace(/\D/g, '') : null,
      cstIcms: icm?.cst_icms != null ? String(icm.cst_icms).replace(/\D/g, '') : null,
      pIcms: icm?.aliquota_estado != null ? Number(icm.aliquota_estado) : null,
      pRedBc:
        icm?.percentual_reduzido != null ? Number(icm.percentual_reduzido) : null,
      cstPis: pis?.codigo != null ? String(pis.codigo).replace(/\D/g, '') : null,
      pPis: pis?.percentual_pis != null ? Number(pis.percentual_pis) : null,
      cstCofins: pis?.codigo != null ? String(pis.codigo).replace(/\D/g, '') : null,
      pCofins:
        pis?.percentual_cofins != null ? Number(pis.percentual_cofins) : null,
      cstIbscbs:
        ibsCst?.cst != null
          ? String(ibsCst.cst).replace(/\D/g, '').padStart(3, '0').slice(0, 3)
          : null,
      cClassTrib:
        ibsClass?.codigo != null
          ? String(ibsClass.codigo).replace(/\D/g, '').padStart(6, '0').slice(0, 6)
          : null,
      indGibscbs: ibsCst?.ind_gibscbs != null ? Number(ibsCst.ind_gibscbs) : null,
      indGibscbsMono:
        ibsCst?.ind_gibscbsmono != null ? Number(ibsCst.ind_gibscbsmono) : null,
      indGred: ibsCst?.ind_gred != null ? Number(ibsCst.ind_gred) : null,
      pRedIbs: ibsClass?.red_ibs != null ? Number(ibsClass.red_ibs) : null,
      pRedCbs: ibsClass?.red_cbs != null ? Number(ibsClass.red_cbs) : null,
      pMono:
        r.aliquota_monofasica != null ? Number(r.aliquota_monofasica) : null,
      gtin: gtin && gtin.length >= 8 ? gtin : null,
      cest: cest && cest.length >= 7 ? cest.padStart(7, '0').slice(0, 7) : null,
      cProdANP: cProdANP || null,
      descANP:
        anpRel?.descricao != null ? String(anpRel.descricao).slice(0, 95) : null,
      pIbptNac:
        ncmRel?.ibpt_aliq_nac != null ? Number(ncmRel.ibpt_aliq_nac) : null,
      pIbptEst:
        ncmRel?.ibpt_aliq_est != null ? Number(ncmRel.ibpt_aliq_est) : null,
    })
  }

  return map
}

function one<T extends Record<string, unknown>>(
  v: T | T[] | null | undefined,
): T | null {
  if (v == null) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

/** Mescla impostos do cadastro no item de transmissão. */
export function aplicarImpostoNoItem(
  item: TransmitItem,
  imposto: ImpostoProduto | undefined,
): TransmitItem {
  if (!imposto) return item
  return {
    ...item,
    ncm: item.ncm || imposto.ncm || undefined,
    cfop: item.cfop || imposto.cfop || undefined,
    csosn: item.csosn ?? imposto.csosn,
    cstIcms: item.cstIcms ?? imposto.cstIcms,
    pIcms: item.pIcms ?? imposto.pIcms,
    pRedBc: item.pRedBc ?? imposto.pRedBc,
    cstPis: item.cstPis ?? imposto.cstPis,
    pPis: item.pPis ?? imposto.pPis,
    cstCofins: item.cstCofins ?? imposto.cstCofins,
    pCofins: item.pCofins ?? imposto.pCofins,
    cstIbscbs: item.cstIbscbs ?? imposto.cstIbscbs,
    cClassTrib: item.cClassTrib ?? imposto.cClassTrib,
    indGibscbs: item.indGibscbs ?? imposto.indGibscbs,
    indGibscbsMono: item.indGibscbsMono ?? imposto.indGibscbsMono,
    indGred: item.indGred ?? imposto.indGred,
    pRedIbs: item.pRedIbs ?? imposto.pRedIbs,
    pRedCbs: item.pRedCbs ?? imposto.pRedCbs,
    pMono: item.pMono ?? imposto.pMono,
    gtin: item.gtin || item.codigo_barras || imposto.gtin || undefined,
    codigo_barras: item.codigo_barras || imposto.gtin || undefined,
    cest: item.cest || imposto.cest || undefined,
    cProdANP: item.cProdANP || imposto.cProdANP || undefined,
    descANP: item.descANP || imposto.descANP || undefined,
    pIbptNac: item.pIbptNac ?? imposto.pIbptNac,
    pIbptEst: item.pIbptEst ?? imposto.pIbptEst,
  }
}
