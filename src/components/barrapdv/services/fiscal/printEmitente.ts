import { FISCAL_CONFIG } from './config'
import type { FiscalDocument } from './types'

export type FiscalPrintEmitter = {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  ie: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  cep: string
  telefone: string
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function xmlTag(xml: string, name: string): string {
  const re = new RegExp(
    `<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
    'i',
  )
  const m = re.exec(xml)
  return m ? m[1].trim() : ''
}

function formatCnpj(value: string) {
  const d = onlyDigits(value).padStart(14, '0').slice(0, 14)
  if (d.length !== 14) return value || ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatCep(value: string) {
  const d = onlyDigits(value)
  if (d.length !== 8) return value || ''
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

function formatFone(value: string) {
  const d = onlyDigits(value)
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  return value || ''
}

function fromConfig(): FiscalPrintEmitter {
  const em = FISCAL_CONFIG.emitter
  return {
    razaoSocial: em.razaoSocial,
    nomeFantasia: em.nomeFantasia,
    cnpj: em.cnpj,
    ie: em.ie,
    endereco: em.endereco,
    bairro: em.bairro,
    cidade: em.cidade,
    uf: em.uf,
    cep: em.cep,
    telefone: em.telefone,
  }
}

/** Extrai emitente do XML autorizado (fonte de verdade do DANFE). */
export function parseEmitenteFromXml(xml: string | undefined | null): FiscalPrintEmitter | null {
  const raw = String(xml || '')
  if (!raw.includes('<emit')) return null

  const emitMatch = /<(?:\w+:)?emit\b[\s\S]*?<\/(?:\w+:)?emit>/i.exec(raw)
  const emit = emitMatch ? emitMatch[0] : ''
  if (!emit) return null

  const enderMatch = /<(?:\w+:)?enderEmit\b[\s\S]*?<\/(?:\w+:)?enderEmit>/i.exec(emit)
  const ender = enderMatch ? enderMatch[0] : ''

  const xLgr = xmlTag(ender, 'xLgr')
  const nro = xmlTag(ender, 'nro')
  const xNome = xmlTag(emit, 'xNome')
  const xFant = xmlTag(emit, 'xFant')
  const cnpj = xmlTag(emit, 'CNPJ')
  if (!xNome && !cnpj) return null

  const endereco = [xLgr, nro].filter(Boolean).join(', ')

  return {
    razaoSocial: xNome || xFant || '',
    nomeFantasia: xFant || xNome || '',
    cnpj: formatCnpj(cnpj),
    ie: xmlTag(emit, 'IE') || 'ISENTO',
    endereco: endereco || '',
    bairro: xmlTag(ender, 'xBairro'),
    cidade: xmlTag(ender, 'xMun'),
    uf: xmlTag(ender, 'UF').toUpperCase(),
    cep: formatCep(xmlTag(ender, 'CEP')),
    telefone: formatFone(xmlTag(ender, 'fone')),
  }
}

/** QR Code já gravado no XML (infNFeSupl) — preferir na impressão. */
export function parseQrCodeFromXml(xml: string | undefined | null): string | null {
  const raw = String(xml || '')
  const qr = xmlTag(raw, 'qrCode')
  return qr || null
}

export function parseAmbienteLabelFromXml(
  xml: string | undefined | null,
): 'Homologação' | 'Produção' | null {
  const tp = xmlTag(String(xml || ''), 'tpAmb')
  if (tp === '1') return 'Produção'
  if (tp === '2') return 'Homologação'
  return null
}

/**
 * Emitente para cupom/DANFE: XML autorizado > config demo.
 */
export function resolvePrintEmitente(doc: FiscalDocument): FiscalPrintEmitter {
  return parseEmitenteFromXml(doc.xml) || fromConfig()
}

export function resolvePrintAmbiente(doc: FiscalDocument): string {
  return parseAmbienteLabelFromXml(doc.xml) || FISCAL_CONFIG.ambiente
}
