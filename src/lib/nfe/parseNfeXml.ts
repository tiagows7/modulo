/** Extrai campos principais de um XML de NF-e (procNFe / nfeProc / NFe). */

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
}

function text(el: Element | null | undefined, tag: string): string {
  if (!el) return ''
  const nodes = el.getElementsByTagName(tag)
  if (!nodes.length) return ''
  return (nodes[0].textContent || '').trim()
}

function onlyDigits(v: string) {
  return String(v || '').replace(/\D/g, '')
}

function toDateIso(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  // 2024-01-15T10:00:00-03:00 or 2024-01-15
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : null
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
  if (chave.startsWith('NFe') || chave.length > 44) {
    chave = onlyDigits(chave).slice(-44)
  }
  // fallback: chNFe no protocolo
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
  }
}
