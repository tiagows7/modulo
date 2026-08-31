/** Extrai cabeçalho e itens de um XML de NF-e (procNFe / nfeProc / NFe). */

export type NfeXmlItem = {
  n_item: number
  c_prod: string
  c_ean: string | null
  x_prod: string
  ncm: string | null
  cest: string | null
  cfop: string | null
  u_com: string | null
  q_com: number
  v_un_com: number
  v_prod: number
  u_trib: string | null
  q_trib: number
  v_un_trib: number
  v_desc: number
  c_prod_anp: string | null
  orig: number | null
  cst_icms: string | null
  v_bc_icms: number
  p_icms: number
  v_icms: number
  v_bc_st: number
  p_icms_st: number
  v_icms_st: number
  cst_ipi: string | null
  v_bc_ipi: number
  p_ipi: number
  v_ipi: number
  cst_pis: string | null
  v_bc_pis: number
  p_pis: number
  v_pis: number
  cst_cofins: string | null
  v_bc_cofins: number
  p_cofins: number
  v_cofins: number
  cbenef: string | null
  cst_ibscbs: number | null
  classtrib: string | null
}

export type NfeXmlTotais = {
  v_bc: number
  v_icms: number
  v_icms_deson: number
  v_bc_st: number
  v_st: number
  v_prod: number
  v_frete: number
  v_seg: number
  v_desc: number
  v_ii: number
  v_ipi: number
  v_pis: number
  v_cofins: number
  v_outro: number
  v_nf: number
  v_tot_trib: number
}

export type NfeXmlParsed = {
  chave: string
  numero: number | null
  serie: string | null
  modelo: string | null
  natureza: string | null
  emissao: string | null
  valor: number
  totais: NfeXmlTotais
  emit_cnpj: string | null
  emit_cpf: string | null
  emit_nome: string | null
  emit_fantasia: string | null
  emit_ie: string | null
  emit_endereco: string | null
  emit_numero: string | null
  emit_bairro: string | null
  emit_municipio: string | null
  emit_cmun: string | null
  emit_uf: string | null
  emit_cep: string | null
  emit_fone: string | null
  dest_cnpj: string | null
  protocolo: string | null
  xml: string
  itens: NfeXmlItem[]
}

function text(el: Element | null | undefined, tag: string): string {
  if (!el) return ''
  const nodes = el.getElementsByTagName(tag)
  if (!nodes.length) return ''
  return (nodes[0].textContent || '').trim()
}

function firstByLocal(parent: Element, local: string): Element | null {
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    if (el.localName === local || el.tagName === local) return el
  }
  return null
}

function textsByLocal(parent: Element, local: string): string {
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    if (el.localName === local || el.tagName === local) {
      return (el.textContent || '').trim()
    }
  }
  return ''
}

function onlyDigits(v: string) {
  return String(v || '').replace(/\D/g, '')
}

function toDateIso(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : null
}

function num(raw: string): number {
  const n = Number(String(raw || '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function parseItens(inf: Element): NfeXmlItem[] {
  const dets = Array.from(inf.getElementsByTagName('det'))
  const items: NfeXmlItem[] = []

  for (const det of dets) {
    const nItem = Number(det.getAttribute('nItem') || items.length + 1) || items.length + 1
    const prod = firstByLocal(det, 'prod')
    if (!prod) continue

    const imposto = firstByLocal(det, 'imposto')
    const comb = firstByLocal(prod, 'comb')

    let orig: number | null = null
    let cstIcms = ''
    let vBcIcms = 0
    let pIcms = 0
    let vIcms = 0
    let vBcSt = 0
    let pIcmsSt = 0
    let vIcmsSt = 0
    let cstIpi = ''
    let vBcIpi = 0
    let pIpi = 0
    let vIpi = 0
    let cstPis = ''
    let vBcPis = 0
    let pPis = 0
    let vPis = 0
    let cstCofins = ''
    let vBcCofins = 0
    let pCofins = 0
    let vCofins = 0

    if (imposto) {
      const icms = firstByLocal(imposto, 'ICMS')
      if (icms) {
        const origRaw = textsByLocal(icms, 'orig')
        if (origRaw !== '') orig = Number(origRaw)
        cstIcms = textsByLocal(icms, 'CST') || textsByLocal(icms, 'CSOSN')
        vBcIcms = num(textsByLocal(icms, 'vBC'))
        pIcms = num(textsByLocal(icms, 'pICMS'))
        vIcms = num(textsByLocal(icms, 'vICMS'))
        vBcSt = num(textsByLocal(icms, 'vBCST'))
        pIcmsSt = num(textsByLocal(icms, 'pICMSST'))
        vIcmsSt = num(textsByLocal(icms, 'vICMSST'))
      }
      const ipi = firstByLocal(imposto, 'IPI')
      if (ipi) {
        cstIpi = textsByLocal(ipi, 'CST')
        vBcIpi = num(textsByLocal(ipi, 'vBC'))
        pIpi = num(textsByLocal(ipi, 'pIPI'))
        vIpi = num(textsByLocal(ipi, 'vIPI'))
      }
      const pis = firstByLocal(imposto, 'PIS')
      if (pis) {
        cstPis = textsByLocal(pis, 'CST')
        vBcPis = num(textsByLocal(pis, 'vBC'))
        pPis = num(textsByLocal(pis, 'pPIS'))
        vPis = num(textsByLocal(pis, 'vPIS'))
      }
      const cofins = firstByLocal(imposto, 'COFINS')
      if (cofins) {
        cstCofins = textsByLocal(cofins, 'CST')
        vBcCofins = num(textsByLocal(cofins, 'vBC'))
        pCofins = num(textsByLocal(cofins, 'pCOFINS'))
        vCofins = num(textsByLocal(cofins, 'vCOFINS'))
      }
    }

    // IBS/CBS (reforma) — tags variam; tenta CST e cClassTrib comuns
    let cstIbscbs: number | null = null
    let classtrib: string | null = null
    if (imposto) {
      const cstRaw =
        textsByLocal(imposto, 'CST') && firstByLocal(imposto, 'IBSCBS')
          ? textsByLocal(firstByLocal(imposto, 'IBSCBS')!, 'CST')
          : textsByLocal(imposto, 'CSTIBSCBS') || ''
      const classRaw =
        textsByLocal(imposto, 'cClassTrib') ||
        (firstByLocal(imposto, 'IBSCBS')
          ? textsByLocal(firstByLocal(imposto, 'IBSCBS')!, 'cClassTrib')
          : '')
      if (cstRaw && /^\d+$/.test(cstRaw)) cstIbscbs = Number(cstRaw)
      if (classRaw) classtrib = classRaw.slice(0, 6)
    }

    const cProd = text(prod, 'cProd') || textsByLocal(prod, 'cProd')
    const xProd = text(prod, 'xProd') || textsByLocal(prod, 'xProd')
    if (!cProd && !xProd) continue

    items.push({
      n_item: nItem,
      c_prod: cProd,
      c_ean: text(prod, 'cEAN') || textsByLocal(prod, 'cEAN') || null,
      x_prod: xProd,
      ncm: text(prod, 'NCM') || null,
      cest: text(prod, 'CEST') || null,
      cfop: text(prod, 'CFOP') || null,
      u_com: text(prod, 'uCom') || null,
      q_com: num(text(prod, 'qCom')),
      v_un_com: num(text(prod, 'vUnCom')),
      v_prod: num(text(prod, 'vProd')),
      u_trib: text(prod, 'uTrib') || null,
      q_trib: num(text(prod, 'qTrib')),
      v_un_trib: num(text(prod, 'vUnTrib')),
      v_desc: num(text(prod, 'vDesc')),
      c_prod_anp: comb ? text(comb, 'cProdANP') || null : null,
      orig,
      cst_icms: cstIcms || null,
      v_bc_icms: vBcIcms,
      p_icms: pIcms,
      v_icms: vIcms,
      v_bc_st: vBcSt,
      p_icms_st: pIcmsSt,
      v_icms_st: vIcmsSt,
      cst_ipi: cstIpi || null,
      v_bc_ipi: vBcIpi,
      p_ipi: pIpi,
      v_ipi: vIpi,
      cst_pis: cstPis || null,
      v_bc_pis: vBcPis,
      p_pis: pPis,
      v_pis: vPis,
      cst_cofins: cstCofins || null,
      v_bc_cofins: vBcCofins,
      p_cofins: pCofins,
      v_cofins: vCofins,
      cbenef: text(prod, 'cBenef') || null,
      cst_ibscbs: cstIbscbs,
      classtrib,
    })
  }

  return items
}

function parseTotais(icmsTot: Element | undefined | null): NfeXmlTotais {
  return {
    v_bc: num(text(icmsTot, 'vBC')),
    v_icms: num(text(icmsTot, 'vICMS')),
    v_icms_deson: num(text(icmsTot, 'vICMSDeson')),
    v_bc_st: num(text(icmsTot, 'vBCST')),
    v_st: num(text(icmsTot, 'vST')),
    v_prod: num(text(icmsTot, 'vProd')),
    v_frete: num(text(icmsTot, 'vFrete')),
    v_seg: num(text(icmsTot, 'vSeg')),
    v_desc: num(text(icmsTot, 'vDesc')),
    v_ii: num(text(icmsTot, 'vII')),
    v_ipi: num(text(icmsTot, 'vIPI')),
    v_pis: num(text(icmsTot, 'vPIS')),
    v_cofins: num(text(icmsTot, 'vCOFINS')),
    v_outro: num(text(icmsTot, 'vOutro')),
    v_nf: num(text(icmsTot, 'vNF')),
    v_tot_trib: num(text(icmsTot, 'vTotTrib')),
  }
}

export function parseNfeXml(xmlRaw: string): NfeXmlParsed {
  const xml = String(xmlRaw || '').trim()
  if (!xml) throw new Error('XML vazio.')

  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parseError = doc.getElementsByTagName('parsererror')[0]
  if (parseError) {
    throw new Error('XML inválido. Selecione um arquivo de NF-e válido.')
  }

  const inf =
    doc.getElementsByTagName('infNFe')[0] ||
    doc.querySelector('infNFe')
  if (!inf) {
    throw new Error('Não foi encontrado o nó infNFe no XML.')
  }

  const ide = inf.getElementsByTagName('ide')[0]
  const emit = inf.getElementsByTagName('emit')[0]
  const dest = inf.getElementsByTagName('dest')[0]
  const enderEmit = emit?.getElementsByTagName('enderEmit')[0]
  const total = inf.getElementsByTagName('total')[0]
  const icmsTot = total?.getElementsByTagName('ICMSTot')[0]
  const totais = parseTotais(icmsTot)

  let chave = onlyDigits(inf.getAttribute('Id') || '')
  if (chave.length > 44) {
    chave = chave.slice(-44)
  }
  if (chave.length !== 44) {
    const chNFe = text(doc.documentElement, 'chNFe')
    chave = onlyDigits(chNFe)
  }
  if (chave.length !== 44) {
    throw new Error('Chave de acesso da NF-e não encontrada (44 dígitos).')
  }

  const numeroRaw = text(ide, 'nNF')
  const valorRaw = text(icmsTot, 'vNF') || text(icmsTot, 'vProd')

  return {
    chave,
    numero: numeroRaw ? Number(numeroRaw) || null : null,
    serie: text(ide, 'serie') || null,
    modelo: text(ide, 'mod') || '55',
    natureza: text(ide, 'natOp') || null,
    emissao: toDateIso(text(ide, 'dhEmi') || text(ide, 'dEmi')),
    valor: Number(valorRaw) || totais.v_nf || 0,
    totais,
    emit_cnpj: onlyDigits(text(emit, 'CNPJ')) || null,
    emit_cpf: onlyDigits(text(emit, 'CPF')) || null,
    emit_nome: text(emit, 'xNome') || null,
    emit_fantasia: text(emit, 'xFant') || null,
    emit_ie: text(emit, 'IE') || null,
    emit_endereco: text(enderEmit, 'xLgr') || null,
    emit_numero: text(enderEmit, 'nro') || null,
    emit_bairro: text(enderEmit, 'xBairro') || null,
    emit_municipio: text(enderEmit, 'xMun') || null,
    emit_cmun: text(enderEmit, 'cMun') || null,
    emit_uf: text(enderEmit, 'UF') || null,
    emit_cep: onlyDigits(text(enderEmit, 'CEP')) || null,
    emit_fone: text(enderEmit, 'fone') || null,
    dest_cnpj: onlyDigits(text(dest, 'CNPJ')) || null,
    protocolo: text(doc.documentElement, 'nProt') || null,
    xml,
    itens: parseItens(inf),
  }
}
