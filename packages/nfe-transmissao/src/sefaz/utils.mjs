/**
 * Utilitários SEFAZ / NFC-e.
 */

export const UF_IBGE = {
  AC: '12',
  AL: '27',
  AP: '16',
  AM: '13',
  BA: '29',
  CE: '23',
  DF: '53',
  ES: '32',
  GO: '52',
  MA: '21',
  MT: '51',
  MS: '50',
  MG: '31',
  PA: '15',
  PB: '25',
  PR: '41',
  PE: '26',
  PI: '22',
  RJ: '33',
  RN: '24',
  RS: '43',
  RO: '11',
  RR: '14',
  SC: '42',
  SP: '35',
  SE: '28',
  TO: '17',
}

/** UFs atendidas pelo SVRS para NFC-e. */
const UF_SVRS = new Set([
  'AC',
  'AL',
  'AP',
  'DF',
  'ES',
  'PB',
  'RJ',
  'RN',
  'RO',
  'RR',
  'SC',
  'SE',
  'TO',
  'RS',
])

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

export function pad(n, size) {
  return String(n).padStart(size, '0')
}

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
}

export function money(value) {
  return roundMoney(value).toFixed(2)
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function ufToIbge(uf) {
  const code = String(uf || '').trim().toUpperCase()
  if (/^\d{2}$/.test(code)) return code
  return UF_IBGE[code] || ''
}

export function ibgeToUf(cUF) {
  const code = String(cUF || '').padStart(2, '0')
  for (const [uf, ibge] of Object.entries(UF_IBGE)) {
    if (ibge === code) return uf
  }
  return ''
}

/**
 * Código IBGE do município (7 dígitos). Não completa com zeros à esquerda —
 * isso gera cMunFG inválido e a SEFAZ rejeita com 225 (schema).
 */
export function normalizeMunicipioIbge(value, cUF) {
  const digits = onlyDigits(value)
  if (digits.length !== 7) {
    throw new Error(
      'Código IBGE do município do emitente inválido (precisa ter 7 dígitos). Confira a cidade da filial.',
    )
  }
  if (digits === '0000000') {
    throw new Error(
      'Código IBGE do município do emitente não informado. Selecione a cidade na filial.',
    )
  }
  const ufCode = onlyDigits(cUF).padStart(2, '0').slice(0, 2)
  if (ufCode && digits.slice(0, 2) !== ufCode) {
    throw new Error(
      `Município IBGE ${digits} não pertence à UF do emitente (cUF ${ufCode}). Ajuste UF/cidade na filial.`,
    )
  }
  return digits
}

export function mod11Chave(base43) {
  let sum = 0
  let weight = 2
  for (let i = base43.length - 1; i >= 0; i -= 1) {
    sum += Number(base43[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  const dv = rest === 0 || rest === 1 ? 0 : 11 - rest
  return String(dv)
}

/**
 * Monta chave de acesso 44 dígitos (NFC-e / NF-e).
 */
export function buildChaveAcesso({
  cUF,
  dhEmi,
  cnpj,
  modelo,
  serie,
  numero,
  tpEmis = '1',
  cNF,
}) {
  const d = dhEmi instanceof Date ? dhEmi : new Date(dhEmi)
  const aamm = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}`
  const base = [
    String(cUF).padStart(2, '0'),
    aamm,
    onlyDigits(cnpj).padStart(14, '0').slice(0, 14),
    String(modelo).padStart(2, '0'),
    pad(Number(serie) || 1, 3),
    pad(Number(numero) || 1, 9),
    String(tpEmis || '1').slice(0, 1),
    pad(Number(cNF) || Math.floor(Math.random() * 1e8), 8),
  ].join('')
  return `${base}${mod11Chave(base)}`
}

/**
 * URLs do webservice NFeAutorizacao4 (NFC-e).
 * Homologação e produção por UF (SVRS + principais autônomos).
 */
export function nfceAutorizacaoUrl(uf, tpAmb) {
  const sigla = String(uf || '').trim().toUpperCase()
  const homolog = tpAmb === 2

  if (sigla === 'SP') {
    return homolog
      ? 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
      : 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
  }
  if (sigla === 'MG') {
    return homolog
      ? 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4'
      : 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4'
  }
  if (sigla === 'PR') {
    return homolog
      ? 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4?wsdl'
      : 'https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4?wsdl'
  }
  if (sigla === 'BA') {
    return homolog
      ? 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
      : 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  }
  if (sigla === 'GO') {
    return homolog
      ? 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl'
      : 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl'
  }
  if (sigla === 'MT') {
    return homolog
      ? 'https://homologacao.sefaz.mt.gov.br/nfce/services/NFeAutorizacao4'
      : 'https://nfce.sefaz.mt.gov.br/nfce/services/NFeAutorizacao4'
  }
  if (sigla === 'MS') {
    return homolog
      ? 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4'
      : 'https://nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4'
  }
  if (sigla === 'AM') {
    return homolog
      ? 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4'
      : 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4'
  }

  // SVRS e demais via SVRS
  if (UF_SVRS.has(sigla) || !sigla) {
    return homolog
      ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
      : 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
  }

  return homolog
    ? 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
    : 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
}

/**
 * URLs do webservice NFeAutorizacao4 (NF-e modelo 55).
 * Homologação e produção por UF (SVRS + principais autônomos).
 */
export function nfeAutorizacaoUrl(uf, tpAmb) {
  const sigla = String(uf || '').trim().toUpperCase()
  const homolog = tpAmb === 2

  if (sigla === 'SP') {
    return homolog
      ? 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx'
      : 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx'
  }
  if (sigla === 'MG') {
    return homolog
      ? 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4'
      : 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4'
  }
  if (sigla === 'PR') {
    return homolog
      ? 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4?wsdl'
      : 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4?wsdl'
  }
  if (sigla === 'BA') {
    return homolog
      ? 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
      : 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  }
  if (sigla === 'GO') {
    return homolog
      ? 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl'
      : 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4?wsdl'
  }
  if (sigla === 'MT') {
    return homolog
      ? 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4'
      : 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4'
  }
  if (sigla === 'MS') {
    return homolog
      ? 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4'
      : 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4'
  }
  if (sigla === 'AM') {
    return homolog
      ? 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4'
      : 'https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4'
  }

  return homolog
    ? 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
    : 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
}

export function nfceQrUrlBase(uf, tpAmb) {
  const sigla = String(uf || '').trim().toUpperCase()
  const homolog = tpAmb === 2
  if (sigla === 'SP') {
    return homolog
      ? 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx'
      : 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx'
  }
  if (sigla === 'RS') {
    return homolog
      ? 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx'
      : 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx'
  }
  // genérico SVRS
  return homolog
    ? 'https://dfe-portal.svrs.rs.gov.br/Nfce/QRCode'
    : 'https://dfe-portal.svrs.rs.gov.br/Nfce/QRCode'
}
