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
  cst_icms: string | null
  p_icms: number
  cst_pis: string | null
  cst_cofins: string | null
  cbenef: string | null
  cst_ibscbs: number | null
  classtrib: string | null
}

export type NfeXmlParsed = {
  chave: string
  numero: number | null
  serie: string | null
  modelo: string | null
  natureza: string | null
  emissao: string | null
  valor: number
  emit_cnpj: string | null
  emit_cpf: string | null
  emit_nome: string | null
  emit_fantasia: string | null
  emit_ie: string | null
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

    let cstIcms = ''
    let pIcms = 0
    let cstPis = ''
    let cstCofins = ''
    if (imposto) {
      const icms = firstByLocal(imposto, 'ICMS')
      if (icms) {
        cstIcms = textsByLocal(icms, 'CST') || textsByLocal(icms, 'CSOSN')
        pIcms = num(textsByLocal(icms, 'pICMS'))
      }
      const pis = firstByLocal(imposto, 'PIS')
      const cofins = firstByLocal(imposto, 'COFINS')
      if (pis) cstPis = textsByLocal(pis, 'CST')
      if (cofins) cstCofins = textsByLocal(cofins, 'CST')
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
      cst_icms: cstIcms || null,
      p_icms: pIcms,
      cst_pis: cstPis || null,
      cst_cofins: cstCofins || null,
      cbenef: text(prod, 'cBenef') || null,
      cst_ibscbs: cstIbscbs,
      classtrib,
    })
  }

  return items
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
  const total = inf.getElementsByTagName('total')[0]
  const icmsTot = total?.getElementsByTagName('ICMSTot')[0]

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
    valor: Number(valorRaw) || 0,
    emit_cnpj: onlyDigits(text(emit, 'CNPJ')) || null,
    emit_cpf: onlyDigits(text(emit, 'CPF')) || null,
    emit_nome: text(emit, 'xNome') || null,
    emit_fantasia: text(emit, 'xFant') || null,
    emit_ie: text(emit, 'IE') || null,
    dest_cnpj: onlyDigits(text(dest, 'CNPJ')) || null,
    protocolo: text(doc.documentElement, 'nProt') || null,
    xml,
    itens: parseItens(inf),
  }
}
