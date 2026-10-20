import { createHash } from 'node:crypto'
import {
  buildChaveAcesso,
  escapeXml,
  ibgeToUf,
  money,
  nfceQrUrlBase,
  normalizeMunicipioIbge,
  onlyDigits,
  pad,
  roundMoney,
  ufToIbge,
} from './utils.mjs'

function digitoVerificadorGtin(code) {
  const d = onlyDigits(code)
  if (![8, 12, 13, 14].includes(d.length)) return null
  let sum = 0
  let mult = 3
  for (let i = d.length - 2; i >= 0; i -= 1) {
    sum += Number(d[i]) * mult
    mult = mult === 3 ? 1 : 3
  }
  const dv = (10 - (sum % 10)) % 10
  return Number(d[d.length - 1]) === dv ? d : null
}

function formaPagamento(methodId, isTef) {
  const id = String(methodId || '').toLowerCase()
  if (id.includes('dinheiro') || id === 'cash' || id === '1') return '01'
  if (id.includes('pix') || id === '17') return '17'
  if (id.includes('debito') || id === '04') return '04'
  if (id.includes('credito') || id === '03') return '03'
  if (isTef) return '03'
  return '99'
}

function resolveCrt(emit) {
  const n = Number(emit?.crt)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

/** ICMS monofásico retido (adRem R$/unidade × quantidade), como no ACBr. */
function calcMonoRet(item, qCom) {
  const adRem = Number(item.pMono) || 0
  if (adRem <= 0) return null
  const q = Number(qCom) || 0
  return {
    qBCMonoRet: q,
    adRemICMSRet: adRem,
    vICMSMonoRet: roundMoney(q * adRem),
  }
}

function buildIcmsXml(item, crt, vProd, qCom = 0) {
  const orig = onlyDigits(item.origem ?? '0').slice(0, 1) || '0'
  const simples = crt === 1 || crt === 2
  const mono = calcMonoRet(item, qCom)

  if (simples) {
    // Monofásico retido → ICMSSN500 com qBCMonoRet / adRem / vICMSMonoRet
    if (mono) {
      return [
        `<ICMS><ICMSSN500>`,
        `<orig>${orig}</orig>`,
        `<CSOSN>500</CSOSN>`,
        `<qBCMonoRet>${mono.qBCMonoRet.toFixed(4)}</qBCMonoRet>`,
        `<adRemICMSRet>${money(mono.adRemICMSRet)}</adRemICMSRet>`,
        `<vICMSMonoRet>${money(mono.vICMSMonoRet)}</vICMSMonoRet>`,
        `</ICMSSN500></ICMS>`,
      ].join('')
    }
    const csosn = onlyDigits(item.csosn || '102').padStart(3, '0').slice(0, 3)
    if (csosn === '101') {
      const pCred = Number(item.pIcms) || 0
      const vCred = roundMoney((vProd * pCred) / 100)
      return [
        `<ICMS><ICMSSN101>`,
        `<orig>${orig}</orig>`,
        `<CSOSN>101</CSOSN>`,
        `<pCredSN>${money(pCred)}</pCredSN>`,
        `<vCredICMSSN>${money(vCred)}</vCredICMSSN>`,
        `</ICMSSN101></ICMS>`,
      ].join('')
    }
    if (csosn === '500') {
      return `<ICMS><ICMSSN500><orig>${orig}</orig><CSOSN>500</CSOSN></ICMSSN500></ICMS>`
    }
    if (csosn === '900') {
      return `<ICMS><ICMSSN900><orig>${orig}</orig><CSOSN>900</CSOSN></ICMSSN900></ICMS>`
    }
    // 102 / 103 / 300 / 400 — grupo ICMSSN102
    const csosnOut = ['102', '103', '300', '400'].includes(csosn) ? csosn : '102'
    return `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>${csosnOut}</CSOSN></ICMSSN102></ICMS>`
  }

  // Regime Normal — CST 61 / alíquota monofásica
  if (mono) {
    return [
      `<ICMS><ICMS61>`,
      `<orig>${orig}</orig>`,
      `<CST>61</CST>`,
      `<qBCMonoRet>${mono.qBCMonoRet.toFixed(4)}</qBCMonoRet>`,
      `<adRemICMSRet>${money(mono.adRemICMSRet)}</adRemICMSRet>`,
      `<vICMSMonoRet>${money(mono.vICMSMonoRet)}</vICMSMonoRet>`,
      `</ICMS61></ICMS>`,
    ].join('')
  }

  const cst = onlyDigits(item.cstIcms || '00').padStart(2, '0').slice(0, 2)
  const pIcms = Number(item.pIcms) || 0
  const pRed = Number(item.pRedBc) || 0

  if (cst === '40' || cst === '41' || cst === '50') {
    return `<ICMS><ICMS40><orig>${orig}</orig><CST>${cst}</CST></ICMS40></ICMS>`
  }
  if (cst === '60') {
    return `<ICMS><ICMS60><orig>${orig}</orig><CST>60</CST></ICMS60></ICMS>`
  }
  if (cst === '20' && pRed > 0) {
    const vBC = roundMoney(vProd * (1 - pRed / 100))
    const vIcms = roundMoney((vBC * pIcms) / 100)
    return [
      `<ICMS><ICMS20>`,
      `<orig>${orig}</orig>`,
      `<CST>20</CST>`,
      `<modBC>3</modBC>`,
      `<pRedBC>${money(pRed)}</pRedBC>`,
      `<vBC>${money(vBC)}</vBC>`,
      `<pICMS>${money(pIcms)}</pICMS>`,
      `<vICMS>${money(vIcms)}</vICMS>`,
      `</ICMS20></ICMS>`,
    ].join('')
  }

  // CST 00 (padrão)
  const vBC = vProd
  const vIcms = roundMoney((vBC * pIcms) / 100)
  return [
    `<ICMS><ICMS00>`,
    `<orig>${orig}</orig>`,
    `<CST>00</CST>`,
    `<modBC>3</modBC>`,
    `<vBC>${money(vBC)}</vBC>`,
    `<pICMS>${money(pIcms)}</pICMS>`,
    `<vICMS>${money(vIcms)}</vICMS>`,
    `</ICMS00></ICMS>`,
  ].join('')
}

function calcIcmsItem(item, crt, vProd, qCom = 0) {
  const mono = calcMonoRet(item, qCom)
  if (mono) {
    return { vBC: 0, vIcms: 0, ...mono }
  }
  const emptyMono = { qBCMonoRet: 0, adRemICMSRet: 0, vICMSMonoRet: 0 }
  const simples = crt === 1 || crt === 2
  if (simples) return { vBC: 0, vIcms: 0, ...emptyMono }
  const cst = onlyDigits(item.cstIcms || '00').padStart(2, '0').slice(0, 2)
  if (['40', '41', '50', '60', '61'].includes(cst)) {
    return { vBC: 0, vIcms: 0, ...emptyMono }
  }
  const pIcms = Number(item.pIcms) || 0
  const pRed = Number(item.pRedBc) || 0
  const vBC =
    cst === '20' && pRed > 0 ? roundMoney(vProd * (1 - pRed / 100)) : vProd
  return { vBC, vIcms: roundMoney((vBC * pIcms) / 100), ...emptyMono }
}

/** Lei da transparência (IBPT): vProd × (aliq nac + est) / 100 */
function calcVTotTrib(item, vProd) {
  if (item.vTotTrib != null && Number(item.vTotTrib) > 0) {
    return roundMoney(item.vTotTrib)
  }
  const nac = Number(item.pIbptNac) || 0
  const est = Number(item.pIbptEst) || 0
  if (nac + est <= 0) return 0
  return roundMoney((vProd * (nac + est)) / 100)
}

function buildPisCofinsXml(item, vProd) {
  const cst = onlyDigits(item.cstPis || item.cstCofins || '07')
    .padStart(2, '0')
    .slice(0, 2)
  const pPis = Number(item.pPis) || 0
  const pCofins = Number(item.pCofins) || 0

  // Não tributado / isento / monofásico sem cálculo
  if (['04', '05', '06', '07', '08', '09'].includes(cst)) {
    return {
      xml: [
        `<PIS><PISNT><CST>${cst}</CST></PISNT></PIS>`,
        `<COFINS><COFINSNT><CST>${cst}</CST></COFINSNT></COFINS>`,
      ].join(''),
      vPis: 0,
      vCofins: 0,
    }
  }

  const vPis = roundMoney((vProd * pPis) / 100)
  const vCofins = roundMoney((vProd * pCofins) / 100)
  return {
    xml: [
      `<PIS><PISAliq>`,
      `<CST>${cst}</CST>`,
      `<vBC>${money(vProd)}</vBC>`,
      `<pPIS>${money(pPis)}</pPIS>`,
      `<vPIS>${money(vPis)}</vPIS>`,
      `</PISAliq></PIS>`,
      `<COFINS><COFINSAliq>`,
      `<CST>${onlyDigits(item.cstCofins || cst).padStart(2, '0').slice(0, 2)}</CST>`,
      `<vBC>${money(vProd)}</vBC>`,
      `<pCOFINS>${money(pCofins)}</pCOFINS>`,
      `<vCOFINS>${money(vCofins)}</vCOFINS>`,
      `</COFINSAliq></COFINS>`,
    ].join(''),
    vPis,
    vCofins,
  }
}

/** CST IBS/CBS que não levam grupo de tributação gIBSCBS. */
const IBSCBS_SEM_GTRIB = new Set(['410', '810', '830'])
/** CST monofásico. */
const IBSCBS_MONO = new Set(['620', '621', '622'])

/** Alíquota com até 4 casas (NT 2025.002: 3v2-4). */
function rate(value) {
  const n = Number(value) || 0
  return (Math.round(n * 10000) / 10000).toFixed(4)
}

function aliqEfet(pAliq, pRed) {
  const p = Number(pAliq) || 0
  const r = Number(pRed) || 0
  if (r <= 0) return p
  return Math.round(p * (1 - r / 100) * 10000) / 10000
}

function defaultAliqIbscbs(item) {
  const envNum = (key) => {
    const v = process.env[key]
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  // Padrão alinhado ao ACBr Delphi (período de transição RTC): IBS-UF 0,1% · CBS 0,9%
  return {
    pIbsUf:
      item.pIbsUf != null && item.pIbsUf !== ''
        ? Number(item.pIbsUf)
        : envNum('NFCE_P_IBS_UF') ?? 0.1,
    pIbsMun:
      item.pIbsMun != null && item.pIbsMun !== ''
        ? Number(item.pIbsMun)
        : envNum('NFCE_P_IBS_MUN') ?? 0,
    pCbs:
      item.pCbs != null && item.pCbs !== ''
        ? Number(item.pCbs)
        : envNum('NFCE_P_CBS') ?? 0.9,
  }
}

/**
 * IBS/CBS (NT 2025.002) — padrão: emitir quando o produto tiver CST/cClassTrib
 * (homologação e produção). Desligar com NFE_EMITIR_IBSCBS=0.
 */
export function shouldEmitIbscbs(_tpAmb, _now = new Date()) {
  const force = String(
    process.env.NFE_EMITIR_IBSCBS || process.env.NFCE_EMITIR_IBSCBS || '',
  )
    .trim()
    .toLowerCase()
  if (force === '0' || force === 'false' || force === 'off') return false
  return true
}

/**
 * Monta grupo IBSCBS (NT 2025.002) a partir do cadastro do produto.
 * Se o produto não tiver CST/cClassTrib, retorna vazio.
 */
/**
 * extras (igual ACBr Delphi): vDesc, vOutro, vPis, vCofins, vIcms, vFcp
 * BC = vProd + frete + seg + outro - desc - PIS - COFINS - ICMS - FCP
 */
function buildIbscbsXml(item, vProd, extras = {}) {
  // sem cadastro IBS/CBS no produto → não emite o grupo
  if (!item.cstIbscbs && !item.cClassTrib) {
    return {
      xml: '',
      vBC: 0,
      vIbsUf: 0,
      vIbsMun: 0,
      vIbs: 0,
      vCbs: 0,
      vIbsMono: 0,
      vCbsMono: 0,
      hasGrupo: false,
    }
  }

  const cstOut = onlyDigits(item.cstIbscbs).padStart(3, '0').slice(0, 3) || '000'
  const classOut =
    onlyDigits(item.cClassTrib).padStart(6, '0').slice(0, 6) || '000001'

  // Sem grupo de tributação (CST 410/810/830 ou ind_gibscbs = 0)
  if (
    IBSCBS_SEM_GTRIB.has(cstOut) ||
    (item.indGibscbs != null && Number(item.indGibscbs) === 0)
  ) {
    return {
      xml: `<IBSCBS><CST>${cstOut}</CST><cClassTrib>${classOut}</cClassTrib></IBSCBS>`,
      vBC: 0,
      vIbsUf: 0,
      vIbsMun: 0,
      vIbs: 0,
      vCbs: 0,
      vIbsMono: 0,
      vCbsMono: 0,
      hasGrupo: true,
    }
  }

  // Monofásico
  if (
    IBSCBS_MONO.has(cstOut) ||
    (item.indGibscbsMono != null && Number(item.indGibscbsMono) === 1)
  ) {
    const pMono = Number(item.pMono) || 0
    const vMono = roundMoney((vProd * pMono) / 100)
    return {
      xml: [
        `<IBSCBS>`,
        `<CST>${cstOut}</CST>`,
        `<cClassTrib>${classOut}</cClassTrib>`,
        `<gIBSCBSMono>`,
        `<adRemIBS>${rate(pMono)}</adRemIBS>`,
        `<adRemCBS>${rate(pMono)}</adRemCBS>`,
        `<vIBSMono>${money(vMono)}</vIBSMono>`,
        `<vCBSMono>${money(vMono)}</vCBSMono>`,
        `</gIBSCBSMono>`,
        `</IBSCBS>`,
      ].join(''),
      vBC: 0,
      vIbsUf: 0,
      vIbsMun: 0,
      vIbs: 0,
      vCbs: 0,
      vIbsMono: vMono,
      vCbsMono: vMono,
      hasGrupo: true,
    }
  }

  const vDesc = Number(extras.vDesc) || 0
  const vOutro = Number(extras.vOutro) || 0
  const vPis = Number(extras.vPis) || 0
  const vCofins = Number(extras.vCofins) || 0
  const vIcms = Number(extras.vIcms) || 0
  const vFcp = Number(extras.vFcp) || 0
  const vBC = roundMoney(
    Math.max(0, vProd + vOutro - vDesc - vPis - vCofins - vIcms - vFcp),
  )

  const { pIbsUf, pIbsMun, pCbs } = defaultAliqIbscbs(item)
  const pRedIbs = Number(item.pRedIbs) || 0
  const pRedCbs = Number(item.pRedCbs) || 0
  const usaRed =
    (item.indGred != null && Number(item.indGred) === 1) ||
    pRedIbs > 0 ||
    pRedCbs > 0

  const pIbsUfEfet = usaRed && pRedIbs > 0 ? aliqEfet(pIbsUf, pRedIbs) : pIbsUf
  const pIbsMunEfet =
    usaRed && pRedIbs > 0 ? aliqEfet(pIbsMun, pRedIbs) : pIbsMun
  const pCbsEfet = usaRed && pRedCbs > 0 ? aliqEfet(pCbs, pRedCbs) : pCbs

  const vIbsUf = roundMoney((vBC * pIbsUfEfet) / 100)
  const vIbsMun = roundMoney((vBC * pIbsMunEfet) / 100)
  const vIbs = roundMoney(vIbsUf + vIbsMun)
  const vCbs = roundMoney((vBC * pCbsEfet) / 100)

  const gRedIbs =
    usaRed && pRedIbs > 0
      ? `<gRed><pRedAliq>${rate(pRedIbs)}</pRedAliq><pAliqEfet>${rate(pIbsUfEfet)}</pAliqEfet></gRed>`
      : ''
  const gRedIbsMun =
    usaRed && pRedIbs > 0
      ? `<gRed><pRedAliq>${rate(pRedIbs)}</pRedAliq><pAliqEfet>${rate(pIbsMunEfet)}</pAliqEfet></gRed>`
      : ''
  const gRedCbs =
    usaRed && pRedCbs > 0
      ? `<gRed><pRedAliq>${rate(pRedCbs)}</pRedAliq><pAliqEfet>${rate(pCbsEfet)}</pAliqEfet></gRed>`
      : ''

  return {
    xml: [
      `<IBSCBS>`,
      `<CST>${cstOut}</CST>`,
      `<cClassTrib>${classOut}</cClassTrib>`,
      `<gIBSCBS>`,
      `<vBC>${money(vBC)}</vBC>`,
      `<gIBSUF>`,
      `<pIBSUF>${rate(pIbsUf)}</pIBSUF>`,
      gRedIbs,
      `<vIBSUF>${money(vIbsUf)}</vIBSUF>`,
      `</gIBSUF>`,
      `<gIBSMun>`,
      `<pIBSMun>${rate(pIbsMun)}</pIBSMun>`,
      gRedIbsMun,
      `<vIBSMun>${money(vIbsMun)}</vIBSMun>`,
      `</gIBSMun>`,
      `<vIBS>${money(vIbs)}</vIBS>`,
      `<gCBS>`,
      `<pCBS>${rate(pCbs)}</pCBS>`,
      gRedCbs,
      `<vCBS>${money(vCbs)}</vCBS>`,
      `</gCBS>`,
      `</gIBSCBS>`,
      `</IBSCBS>`,
    ].join(''),
    vBC,
    vIbsUf,
    vIbsMun,
    vIbs,
    vCbs,
    vIbsMono: 0,
    vCbsMono: 0,
    hasGrupo: true,
  }
}

/**
 * Hash CSC do QR Code NFC-e (versão 2).
 * SHA-1(chave|2|tpAmb|idCSC|CSC) em hex minúsculo.
 */
export function hashCscQr({ chave, tpAmb, idCsc, csc }) {
  const id = onlyDigits(String(idCsc || '')).replace(/^0+/, '') || '1'
  const raw = `${chave}|2|${tpAmb}|${id}|${String(csc || '').trim()}`
  return createHash('sha1').update(raw, 'utf8').digest('hex')
}

export function buildQrCodeUrl({
  uf,
  tpAmb,
  chave,
  idCsc,
  csc,
}) {
  const base = nfceQrUrlBase(uf, tpAmb)
  const id = onlyDigits(String(idCsc || '')).replace(/^0+/, '') || '1'
  const hash = hashCscQr({ chave, tpAmb, idCsc: id, csc })
  const p = `${chave}|2|${tpAmb}|${id}|${hash}`
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}p=${p}`
}

/**
 * Monta XML da NFC-e (modelo 65) ou NF-e (modelo 55) sem assinatura.
 * CNPJ no destinatário → NF-e; CPF ou sem documento → NFC-e.
 * Retorna { xmlInfNFe, chave, dhEmi, total, modelo }.
 */
export function buildInfNFeXml(input) {
  const tipo = input.tipo === 'NF-e' ? 'NF-e' : 'NFC-e'
  const isNfe = tipo === 'NF-e'
  const modelo = isNfe ? '55' : '65'

  const emit = input.emitente || {}
  const cnpj = onlyDigits(emit.cnpj || '')
  if (cnpj.length !== 14) {
    throw new Error('CNPJ do emitente inválido para emissão SEFAZ.')
  }

  const uf = String(emit.uf || 'SP').trim().toUpperCase()
  const cUF = ufToIbge(uf)
  if (!cUF) throw new Error(`UF do emitente inválida: ${uf}`)

  const cMun = normalizeMunicipioIbge(emit.municipioIbge, cUF)

  const ie = onlyDigits(emit.ie || '')
  if (!ie) throw new Error('IE do emitente é obrigatória para NFC-e.')

  const tokenId = onlyDigits(emit.tokenId || '')
  const tokenNfce = String(emit.tokenNfce || '').trim()
  if (!isNfe && (!tokenId || !tokenNfce)) {
    throw new Error(
      'Token ID (idCSC) e Token NFC-e (CSC) da filial são obrigatórios.',
    )
  }

  const buyer = input.buyer || {}
  const buyerDoc = onlyDigits(buyer.document || '')
  if (isNfe && buyerDoc.length !== 14) {
    throw new Error('NF-e exige CNPJ do destinatário (14 dígitos).')
  }

  const items = Array.isArray(input.items) ? input.items : []
  if (!items.length) throw new Error('Informe ao menos um item para transmitir.')

  const numero = Number(input.numero)
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error('Número fiscal inválido para transmissão SEFAZ.')
  }
  const serie = Number(input.serie) || 1
  const tpAmb = input.ambiente === 1 ? 1 : 2
  const emitirIbscbs = shouldEmitIbscbs(tpAmb)
  const dhEmi = new Date()
  const cNF = pad(Math.floor(Math.random() * 1e8), 8)
  const chave = buildChaveAcesso({
    cUF,
    dhEmi,
    cnpj,
    modelo,
    serie,
    numero,
    tpEmis: '1',
    cNF,
  })

  const destUf = String(buyer.uf || uf).trim().toUpperCase() || uf
  const idDest = destUf && destUf !== uf ? '2' : '1'

  const total =
    input.total != null
      ? roundMoney(input.total)
      : roundMoney(items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0))

  const dhEmiIso = formatDhEmi(dhEmi)
  const xNomeEmit = escapeXml(emit.razaoSocial || 'EMITENTE')
  const xFant = escapeXml(emit.fantasia || emit.razaoSocial || 'EMITENTE')
  const xMun = escapeXml(emit.cidade || ibgeToUf(cUF) || 'MUNICIPIO')
  const xLgr = escapeXml(emit.endereco || 'S/N')
  const nro = escapeXml(emit.numero || 'S/N')
  const xBairro = escapeXml(emit.bairro || 'CENTRO')
  const cep = onlyDigits(emit.cep || '').padStart(8, '0').slice(0, 8)
  const fone = onlyDigits(emit.telefone || '').slice(0, 14)

  const crt = resolveCrt(emit)
  let somaVBc = 0
  let somaVIcms = 0
  let somaVPis = 0
  let somaVCofins = 0
  let somaVBcIbscbs = 0
  let somaVIbsUf = 0
  let somaVIbsMun = 0
  let somaVIbs = 0
  let somaVCbs = 0
  let somaVIbsMono = 0
  let somaVCbsMono = 0
  let somaQBCMonoRet = 0
  let somaVIcmsMonoRet = 0
  let somaVTotTrib = 0
  let temIbscbs = false

  const det = items
    .map((item, idx) => {
      const nItem = idx + 1
      const qCom = Number(item.qty) || 0
      const vUn = roundMoney(item.price)
      const vProd = roundMoney(qCom * vUn)
      const vDesc = roundMoney(item.discount || 0)
      const uCom = escapeXml((item.unit || 'UN').slice(0, 6))
      const cProd = escapeXml(
        String(item.productCode || item.id || nItem).slice(0, 60),
      )
      let xProd = String(item.name || `Item ${nItem}`).slice(0, 120)
      if (tpAmb === 2 && nItem === 1) {
        xProd = `NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL`
      }
      xProd = escapeXml(xProd)
      const ncm = onlyDigits(item.ncm || '00000000').padStart(8, '0').slice(0, 8)
      const cestDig = onlyDigits(item.cest || '').slice(0, 7)
      const cest =
        cestDig.length === 7 && cestDig !== '0000000'
          ? cestDig.padStart(7, '0')
          : ''
      let cfop = onlyDigits(
        item.cfop || (item.kind === 'combustivel' ? '5656' : '5102'),
      ).slice(0, 4)
      if (idDest === '2' && cfop.startsWith('5')) {
        cfop = `6${cfop.slice(1)}`
      }
      const gtin = digitoVerificadorGtin(item.gtin || item.codigo_barras || '')
      const cEAN = gtin || 'SEM GTIN'
      const cEANTrib = cEAN
      const cProdANP = onlyDigits(item.cProdANP || '').slice(0, 9)
      const combXml =
        cProdANP.length >= 9
          ? [
              `<comb>`,
              `<cProdANP>${cProdANP}</cProdANP>`,
              item.descANP
                ? `<descANP>${escapeXml(String(item.descANP).slice(0, 95))}</descANP>`
                : '',
              `<UFCons>${uf}</UFCons>`,
              `</comb>`,
            ].join('')
          : ''

      const icms = buildIcmsXml(item, crt, vProd, qCom)
      const icmsVal = calcIcmsItem(item, crt, vProd, qCom)
      const vTotTribItem = calcVTotTrib(item, vProd)
      const pisCofins = buildPisCofinsXml(item, vProd)
      const ibscbs = emitirIbscbs
        ? buildIbscbsXml(item, vProd, {
            vDesc,
            vOutro: 0,
            vPis: pisCofins.vPis,
            vCofins: pisCofins.vCofins,
            vIcms: icmsVal.vIcms,
            vFcp: 0,
          })
        : {
            xml: '',
            vBC: 0,
            vIbsUf: 0,
            vIbsMun: 0,
            vIbs: 0,
            vCbs: 0,
            vIbsMono: 0,
            vCbsMono: 0,
            hasGrupo: false,
          }
      somaVBc += icmsVal.vBC
      somaVIcms += icmsVal.vIcms
      somaVPis += pisCofins.vPis
      somaVCofins += pisCofins.vCofins
      somaQBCMonoRet += icmsVal.qBCMonoRet || 0
      somaVIcmsMonoRet += icmsVal.vICMSMonoRet || 0
      somaVTotTrib += vTotTribItem
      if (ibscbs.hasGrupo) {
        temIbscbs = true
        somaVBcIbscbs += ibscbs.vBC
        somaVIbsUf += ibscbs.vIbsUf
        somaVIbsMun += ibscbs.vIbsMun
        somaVIbs += ibscbs.vIbs
        somaVCbs += ibscbs.vCbs
        somaVIbsMono += ibscbs.vIbsMono
        somaVCbsMono += ibscbs.vCbsMono
      }

      return [
        `<det nItem="${nItem}">`,
        `<prod>`,
        `<cProd>${cProd}</cProd>`,
        `<cEAN>${cEAN}</cEAN>`,
        `<xProd>${xProd}</xProd>`,
        `<NCM>${ncm}</NCM>`,
        cest ? `<CEST>${cest}</CEST>` : '',
        `<CFOP>${cfop}</CFOP>`,
        `<uCom>${uCom}</uCom>`,
        `<qCom>${qCom.toFixed(4)}</qCom>`,
        `<vUnCom>${money(vUn)}</vUnCom>`,
        `<vProd>${money(vProd)}</vProd>`,
        `<cEANTrib>${cEANTrib}</cEANTrib>`,
        `<uTrib>${uCom}</uTrib>`,
        `<qTrib>${qCom.toFixed(4)}</qTrib>`,
        `<vUnTrib>${money(vUn)}</vUnTrib>`,
        vDesc > 0 ? `<vDesc>${money(vDesc)}</vDesc>` : '',
        `<indTot>1</indTot>`,
        combXml,
        `</prod>`,
        `<imposto>`,
        vTotTribItem > 0 ? `<vTotTrib>${money(vTotTribItem)}</vTotTrib>` : '',
        icms,
        pisCofins.xml,
        ibscbs.xml,
        `</imposto>`,
        `</det>`,
      ].join('')
    })
    .join('')

  const payments = Array.isArray(input.payments) ? input.payments : []
  const detPag =
    payments.length > 0
      ? payments
          .map((p) => {
            const tPag = formaPagamento(p.methodId, p.isTef)
            return `<detPag><tPag>${tPag}</tPag><vPag>${money(p.amount)}</vPag></detPag>`
          })
          .join('')
      : `<detPag><tPag>01</tPag><vPag>${money(total)}</vPag></detPag>`

  const destIe = onlyDigits(buyer.ie || '')
  const indIEDest = destIe ? '1' : '9'
  const destNome =
    isNfe && tpAmb === 2
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : escapeXml(buyer.name || (isNfe ? 'DESTINATARIO' : 'CONSUMIDOR'))
  const destMun = onlyDigits(buyer.municipioIbge || '')
  const destCMun =
    destMun.length === 7 ? destMun : idDest === '1' ? cMun : ''
  if (isNfe && destCMun.length !== 7) {
    throw new Error(
      'NF-e precisa do código IBGE do município do destinatário (consulte o CNPJ).',
    )
  }
  // NFC-e: enderDest quando há endereço informado (como no ACBr); NF-e: sempre
  const temEnderBuyer = Boolean(
    buyer.address || buyer.neighborhood || buyer.cep || buyer.city,
  )
  const cMunEnder =
    destCMun.length === 7 ? destCMun : temEnderBuyer && !isNfe ? cMun : ''
  const destXmlEnder =
    isNfe || (temEnderBuyer && cMunEnder.length === 7)
      ? [
          `<enderDest>`,
          `<xLgr>${escapeXml(buyer.address || emit.endereco || 'S/N')}</xLgr>`,
          `<nro>${escapeXml(buyer.number || emit.numero || 'S/N')}</nro>`,
          `<xBairro>${escapeXml(buyer.neighborhood || emit.bairro || 'CENTRO')}</xBairro>`,
          `<cMun>${isNfe ? destCMun : cMunEnder}</cMun>`,
          `<xMun>${escapeXml(buyer.city || emit.cidade || 'MUNICIPIO')}</xMun>`,
          `<UF>${destUf || uf}</UF>`,
          `<CEP>${onlyDigits(buyer.cep || emit.cep || '').padStart(8, '0').slice(0, 8)}</CEP>`,
          `<cPais>1058</cPais>`,
          `<xPais>BRASIL</xPais>`,
          onlyDigits(buyer.phone || '').length >= 6
            ? `<fone>${onlyDigits(buyer.phone).slice(0, 14)}</fone>`
            : '',
          `</enderDest>`,
        ].join('')
      : ''
  const dest =
    buyerDoc.length === 11
      ? [
          `<dest>`,
          `<CPF>${buyerDoc}</CPF>`,
          `<xNome>${destNome}</xNome>`,
          destXmlEnder,
          `<indIEDest>9</indIEDest>`,
          buyer.email ? `<email>${escapeXml(buyer.email)}</email>` : '',
          `</dest>`,
        ].join('')
      : buyerDoc.length === 14
        ? [
            `<dest>`,
            `<CNPJ>${buyerDoc}</CNPJ>`,
            `<xNome>${isNfe && tpAmb === 2 ? destNome : escapeXml(buyer.name || 'DESTINATARIO')}</xNome>`,
            destXmlEnder,
            `<indIEDest>${indIEDest}</indIEDest>`,
            destIe ? `<IE>${destIe}</IE>` : '',
            buyer.email ? `<email>${escapeXml(buyer.email)}</email>` : '',
            `</dest>`,
          ].join('')
        : ''

  const qrCode = isNfe
    ? ''
    : buildQrCodeUrl({
        uf,
        tpAmb,
        chave,
        idCsc: tokenId,
        csc: tokenNfce,
      })
  const urlChave = qrCode ? qrCode.split('?')[0] : ''

  const ibscbsTot = temIbscbs
    ? [
        `<IBSCBSTot>`,
        `<vBCIBSCBS>${money(somaVBcIbscbs)}</vBCIBSCBS>`,
        `<gIBS>`,
        `<gIBSUF>`,
        `<vDif>0.00</vDif>`,
        `<vDevTrib>0.00</vDevTrib>`,
        `<vIBSUF>${money(somaVIbsUf)}</vIBSUF>`,
        `</gIBSUF>`,
        `<gIBSMun>`,
        `<vDif>0.00</vDif>`,
        `<vDevTrib>0.00</vDevTrib>`,
        `<vIBSMun>${money(somaVIbsMun)}</vIBSMun>`,
        `</gIBSMun>`,
        `<vIBS>${money(somaVIbs)}</vIBS>`,
        `<vCredPres>0.00</vCredPres>`,
        `<vCredPresCondSus>0.00</vCredPresCondSus>`,
        `</gIBS>`,
        `<gCBS>`,
        `<vDif>0.00</vDif>`,
        `<vDevTrib>0.00</vDevTrib>`,
        `<vCBS>${money(somaVCbs)}</vCBS>`,
        `<vCredPres>0.00</vCredPres>`,
        `<vCredPresCondSus>0.00</vCredPresCondSus>`,
        `</gCBS>`,
        somaVIbsMono > 0 || somaVCbsMono > 0
          ? [
              `<gMono>`,
              `<vIBSMono>${money(somaVIbsMono)}</vIBSMono>`,
              `<vCBSMono>${money(somaVCbsMono)}</vCBSMono>`,
              `<vIBSMonoReten>0.00</vIBSMonoReten>`,
              `<vCBSMonoReten>0.00</vCBSMonoReten>`,
              `<vIBSMonoRet>0.00</vIBSMonoRet>`,
              `<vCBSMonoRet>0.00</vCBSMonoRet>`,
              `</gMono>`,
            ].join('')
          : '',
        `</IBSCBSTot>`,
      ].join('')
    : ''

  const infNFe = [
    `<infNFe Id="NFe${chave}" versao="4.00">`,
    `<ide>`,
    `<cUF>${cUF}</cUF>`,
    `<cNF>${cNF}</cNF>`,
    `<natOp>VENDA</natOp>`,
    `<mod>${modelo}</mod>`,
    `<serie>${serie}</serie>`,
    `<nNF>${numero}</nNF>`,
    `<dhEmi>${dhEmiIso}</dhEmi>`,
    `<tpNF>1</tpNF>`,
    `<idDest>${isNfe ? idDest : '1'}</idDest>`,
    `<cMunFG>${cMun}</cMunFG>`,
    `<tpImp>${isNfe ? '1' : '4'}</tpImp>`,
    `<tpEmis>1</tpEmis>`,
    `<cDV>${chave.slice(-1)}</cDV>`,
    `<tpAmb>${tpAmb}</tpAmb>`,
    `<finNFe>1</finNFe>`,
    `<indFinal>${isNfe && indIEDest === '1' ? '0' : '1'}</indFinal>`,
    `<indPres>1</indPres>`,
    // ACBr Delphi: iiSemOperacao — obrigatório no leiaute atual
    `<indIntermed>0</indIntermed>`,
    `<procEmi>0</procEmi>`,
    `<verProc>ModuloPDV1.0</verProc>`,
    `</ide>`,
    `<emit>`,
    `<CNPJ>${cnpj}</CNPJ>`,
    `<xNome>${xNomeEmit}</xNome>`,
    `<xFant>${xFant}</xFant>`,
    `<enderEmit>`,
    `<xLgr>${xLgr}</xLgr>`,
    `<nro>${nro}</nro>`,
    `<xBairro>${xBairro}</xBairro>`,
    `<cMun>${cMun}</cMun>`,
    `<xMun>${xMun}</xMun>`,
    `<UF>${uf}</UF>`,
    `<CEP>${cep}</CEP>`,
    `<cPais>1058</cPais>`,
    `<xPais>BRASIL</xPais>`,
    fone ? `<fone>${fone}</fone>` : '',
    `</enderEmit>`,
    `<IE>${ie}</IE>`,
    `<CRT>${crt}</CRT>`,
    `</emit>`,
    dest,
    det,
    `<total>`,
    `<ICMSTot>`,
    `<vBC>${money(somaVBc)}</vBC>`,
    `<vICMS>${money(somaVIcms)}</vICMS>`,
    `<vICMSDeson>0.00</vICMSDeson>`,
    `<vFCP>0.00</vFCP>`,
    `<vBCST>0.00</vBCST>`,
    `<vST>0.00</vST>`,
    `<vFCPST>0.00</vFCPST>`,
    `<vFCPSTRet>0.00</vFCPSTRet>`,
    somaVIcmsMonoRet > 0
      ? [
          `<qBCMonoRet>${somaQBCMonoRet.toFixed(4)}</qBCMonoRet>`,
          `<vICMSMonoRet>${money(somaVIcmsMonoRet)}</vICMSMonoRet>`,
        ].join('')
      : '',
    `<vProd>${money(total)}</vProd>`,
    `<vFrete>0.00</vFrete>`,
    `<vSeg>0.00</vSeg>`,
    `<vDesc>0.00</vDesc>`,
    `<vII>0.00</vII>`,
    `<vIPI>0.00</vIPI>`,
    `<vIPIDevol>0.00</vIPIDevol>`,
    `<vPIS>${money(somaVPis)}</vPIS>`,
    `<vCOFINS>${money(somaVCofins)}</vCOFINS>`,
    `<vOutro>0.00</vOutro>`,
    `<vNF>${money(total)}</vNF>`,
    somaVTotTrib > 0 ? `<vTotTrib>${money(somaVTotTrib)}</vTotTrib>` : '',
    `</ICMSTot>`,
    ibscbsTot,
    // ACBr Delphi: Total.vNFTot := vNF + IBS + CBS
    temIbscbs
      ? `<vNFTot>${money(total + somaVIbs + somaVCbs)}</vNFTot>`
      : '',
    `</total>`,
    `<transp><modFrete>9</modFrete></transp>`,
    `<pag>${detPag}</pag>`,
    `<infAdic><infCpl>${escapeXml(`Pedido ${input.saleRef || ''}`)}</infCpl></infAdic>`,
    `<infRespTec>`,
    `<CNPJ>${cnpj}</CNPJ>`,
    `<xContato>${xNomeEmit}</xContato>`,
    `<email>fiscal@localhost</email>`,
    `<fone>${fone || '0000000000'}</fone>`,
    `</infRespTec>`,
    `</infNFe>`,
  ].join('')

  const xmlInfNFeSupl = isNfe
    ? ''
    : [
        `<infNFeSupl>`,
        `<qrCode>${escapeXml(qrCode)}</qrCode>`,
        `<urlChave>${escapeXml(urlChave)}</urlChave>`,
        `</infNFeSupl>`,
      ].join('')

  return {
    chave,
    dhEmi,
    total,
    tpAmb,
    serie: String(serie),
    numero,
    modelo,
    tipo,
    cUF,
    cMun,
    uf,
    emitiuIbscbs: temIbscbs,
    xmlInfNFe: infNFe,
    xmlInfNFeSupl,
    qrCode,
  }
}

function formatDhEmi(d) {
  const pad2 = (n) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  const oh = pad2(Math.floor(abs / 60))
  const om = pad2(abs % 60)
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  )
}
