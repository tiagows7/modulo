import QRCode from 'qrcode'
import { FISCAL_CONFIG } from './config'
import type { FiscalDocument } from './types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatChaveGroups(chave: string) {
  return chave.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Separador na largura da bobina 80mm (fonte A ≈ 48 colunas). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RULE = '-'.repeat(48)
/** Separador com fonte B / pequena (≈ 64 colunas). */
const RULE_SMALL = '-'.repeat(64)

function lineGross(item: { qty: number; price: number }) {
  return round2(item.qty * item.price)
}

function lineNet(item: { qty: number; price: number; discount?: number }) {
  return round2(lineGross(item) - (item.discount ?? 0))
}

/**
 * Conteúdo do QR Code NFC-e (consulta pública).
 * Formato aproximado NT 2015.002 — sem CSC/hash real até integração SEFAZ.
 */
export function buildNfceQrPayload(doc: FiscalDocument): string {
  const chave = onlyDigits(doc.chave)
  const uf = (FISCAL_CONFIG.emitter.uf || 'SP').toUpperCase()
  const ambiente = FISCAL_CONFIG.ambiente === 'Produção' ? '1' : '2'
  // p = chave|versao|ambiente|cIdToken|hashCSC  (hash vazio no mock)
  const p = `${chave}|2|${ambiente}|1|`

  const byUf: Record<string, string> = {
    SP: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(p)}`,
    RJ: `https://www.nfce.fazenda.rj.gov.br/consulta?p=${encodeURIComponent(p)}`,
    MG: `https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=${encodeURIComponent(p)}`,
    PR: `https://www.fazenda.pr.gov.br/nfce/qrcode?p=${encodeURIComponent(p)}`,
    RS: `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${encodeURIComponent(p)}`,
    SC: `https://sat.sef.sc.gov.br/nfce/consulta?p=${encodeURIComponent(p)}`,
    BA: `https://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=${encodeURIComponent(p)}`,
    GO: `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${encodeURIComponent(p)}`,
  }

  return byUf[uf] || `https://www.nfce.fazenda.gov.br/portal/consultaQRCode.aspx?p=${encodeURIComponent(p)}`
}

async function buildNfceQrDataUrl(payload: string, size = 160): Promise<string | null> {
  try {
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    return null
  }
}

/**
 * Cupom completo NFC-e para impressoras não-fiscais (ESCPOS / térmica 80mm).
 * Equivalente ao DANFE NFC-e via ACBr DANFeESCPOS no Delphi.
 */
export function buildNfceNonFiscalText(doc: FiscalDocument): string {
  const em = FISCAL_CONFIG.emitter
  const discountTotal = round2(
    doc.items.reduce((sum, item) => sum + (item.discount ?? 0), 0),
  )
  const itemsGross = round2(doc.items.reduce((sum, item) => sum + lineGross(item), 0))
  const fantasia = (em.nomeFantasia || em.razaoSocial || '').trim()
  // <<CENTER>> / <<LEFT>> = alinhamento ESC/POS na ponte fiscal
  const lines: string[] = [
    '<<CENTER>>',
    '<<SMALL>>',
    fantasia,
    `CNPJ: ${em.cnpj}  IE: ${em.ie}`,
    `${em.endereco} - ${em.bairro} - ${em.cidade}/${em.uf} - CEP ${em.cep} - Tel. ${em.telefone}`,
    RULE_SMALL,
    'DANFE NFC-e',
    'Documento Auxiliar da Nota Fiscal',
    'de Consumidor Eletronica',
    RULE_SMALL,
    '<<LEFT>>',
    `NFC-e n. ${doc.numero}  Serie ${doc.serie}  ${doc.emissao} ${doc.hora}`,
    'CHAVE DE ACESSO',
    formatChaveGroups(doc.chave),
    `Protocolo ${doc.protocol || '-'}`,
    `Ambiente: ${FISCAL_CONFIG.ambiente}`,
    RULE_SMALL,
    'CONSUMIDOR',
    doc.cliente || 'Consumidor nao identificado',
  ]

  if (doc.buyerDocument) lines.push(`CPF/CNPJ: ${doc.buyerDocument}`)

  lines.push(RULE_SMALL)
  lines.push('COD/DESC  QTD  UN  VL UNIT  TOTAL')

  doc.items.forEach((item, index) => {
    const seq = String(index + 1).padStart(3, '0')
    const code = String(item.productCode ?? item.id)
    lines.push(`${seq} ${code} ${item.name}`)
    lines.push(
      `  ${item.qty} ${item.unit} x ${money(item.price)} = ${money(lineGross(item))}`,
    )
    if ((item.discount ?? 0) > 0) {
      lines.push(`  Desconto item: -${money(item.discount ?? 0)}`)
      lines.push(`  Liquido: ${money(lineNet(item))}`)
    }
  })

  lines.push(RULE_SMALL)
  lines.push(`Qtde. total de itens: ${doc.items.length}`)
  lines.push(`Valor dos produtos: ${money(itemsGross)}`)
  if (discountTotal > 0) {
    lines.push(`Descontos: -${money(discountTotal)}`)
  }
  lines.push(`TOTAL A PAGAR: ${money(doc.valor)}`)
  lines.push(RULE_SMALL)

  if (doc.payments.length > 0) {
    lines.push('FORMA DE PAGAMENTO')
    for (const p of doc.payments) {
      const extra = [p.brand, p.nsu ? `NSU ${p.nsu}` : null, p.authorizationCode ? `AUT ${p.authorizationCode}` : null]
        .filter(Boolean)
        .join(' · ')
      lines.push(`  ${p.label || p.methodId}: ${money(p.amount)}`)
      if (extra) lines.push(`    ${extra}`)
    }
    lines.push(RULE_SMALL)
  }

  const tribApprox = round2(doc.valor * 0.1675)
  // QR à esquerda + tributos ao lado
  lines.push('<<QR_BESIDE>>')
  lines.push('Tributos totais incidentes')
  lines.push('(Lei Federal 12.741/2012)')
  lines.push(`Valor approx.: ${money(tribApprox)}`)
  lines.push('<<END_QR_BESIDE>>')
  lines.push(RULE_SMALL)
  lines.push('CUPOM NFC-e')
  lines.push(`Ref. venda: ${doc.saleRef}`)
  lines.push('<<NORMAL>>')

  return lines.filter((l) => l !== '').join('\n')
}

/**
 * HTML do cupom completo NFC-e (80mm) para impressoras não-fiscais.
 */
export async function buildNfceNonFiscalHtml(doc: FiscalDocument): Promise<string> {
  const em = FISCAL_CONFIG.emitter
  const discountTotal = round2(
    doc.items.reduce((sum, item) => sum + (item.discount ?? 0), 0),
  )
  const itemsGross = round2(doc.items.reduce((sum, item) => sum + lineGross(item), 0))
  const tribApprox = round2(doc.valor * 0.1675)
  const qrPayload = buildNfceQrPayload(doc)
  const qrSrc = await buildNfceQrDataUrl(qrPayload, 160)
  const qrBlock = qrSrc
    ? `<img class="qr" src="${qrSrc}" width="96" height="96" alt="QR Code NFC-e" />`
    : `<div class="qr-fallback">QR</div>`

  const itemsRows = doc.items
    .map((item, index) => {
      const seq = String(index + 1).padStart(3, '0')
      const code = escapeHtml(String(item.productCode ?? item.id))
      const discount = item.discount ?? 0
      return `<tr>
        <td colspan="4"><strong>${seq}</strong> ${code}<br />${escapeHtml(item.name)}</td>
      </tr>
      <tr>
        <td class="num">${item.qty} ${escapeHtml(item.unit)}</td>
        <td class="num">${money(item.price)}</td>
        <td class="num">${money(lineGross(item))}</td>
        <td class="num">${discount > 0 ? `−${money(discount)}` : '—'}</td>
      </tr>`
    })
    .join('')

  const payRows = doc.payments
    .map((p) => {
      const extra = [p.brand, p.nsu ? `NSU ${p.nsu}` : null, p.authorizationCode ? `AUT ${p.authorizationCode}` : null]
        .filter(Boolean)
        .join(' · ')
      return `<div class="pay-line">
        <span>${escapeHtml(p.label || p.methodId)}${extra ? `<br /><small>${escapeHtml(extra)}</small>` : ''}</span>
        <strong>${money(p.amount)}</strong>
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>NFC-e ${escapeHtml(doc.numero)} — Cupom</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 10px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9px;
      color: #111;
      width: 80mm;
      line-height: 1.3;
    }
    h1 { font-size: 10px; margin: 0 0 2px; text-align: center; text-transform: uppercase; }
    h2 {
      font-size: 9px; margin: 0; text-align: center; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.02em;
    }
    .muted { color: #333; text-align: center; font-size: 8px; }
    .header .muted { font-size: 8px; }
    .rule { border: none; border-top: 1px dashed #222; margin: 6px 0; }
    .meta, .block { display: grid; gap: 2px; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; font-size: 8px; }
    th { text-align: left; border-bottom: 1px solid #222; }
    .num { text-align: right; white-space: nowrap; }
    .total {
      font-size: 11px; font-weight: 700;
      display: flex; justify-content: space-between; margin-top: 4px;
    }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 9px; }
    .chave { font-size: 8px; word-break: break-all; letter-spacing: 0.03em; text-align: center; }
    .pay-line { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; font-size: 9px; }
    .pay-line small { color: #444; }
    .qr {
      margin: 0;
      width: 96px;
      height: 96px;
      display: block;
      border: 0;
      background: #fff;
      flex-shrink: 0;
    }
    .qr-trib {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      margin: 6px 0;
    }
    .qr-trib .trib {
      flex: 1;
      font-size: 8px;
      line-height: 1.3;
      text-align: left;
    }
    .qr-fallback {
      margin: 0;
      width: 96px;
      height: 96px;
      display: grid;
      place-items: center;
      border: 1px dashed #444;
      font-size: 8px;
      color: #333;
      flex-shrink: 0;
    }
    .badge { text-align: center; font-weight: 700; margin-top: 6px; font-size: 8px; }
    .header { text-align: center; font-size: 8px; }
    .header h1 { margin-bottom: 4px; font-size: 10px; }
    .header h2 { font-size: 9px; }
    @media print {
      body { width: auto; padding: 0; }
      @page { margin: 4mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(em.nomeFantasia || em.razaoSocial)}</h1>
    <div class="muted">
      CNPJ ${escapeHtml(em.cnpj)} · IE ${escapeHtml(em.ie)}<br />
      ${escapeHtml(em.endereco)} — ${escapeHtml(em.bairro)} — ${escapeHtml(em.cidade)}/${escapeHtml(em.uf)} — CEP ${escapeHtml(em.cep)} — Tel. ${escapeHtml(em.telefone)}
    </div>
    <hr class="rule" />
    <h2>DANFE NFC-e</h2>
    <div class="muted">Documento Auxiliar da Nota Fiscal<br />de Consumidor Eletrônica</div>
  </div>
  <hr class="rule" />
  <div class="meta">
    <strong>NFC-e nº ${escapeHtml(doc.numero)} — Série ${escapeHtml(doc.serie)} — ${escapeHtml(doc.emissao)} ${escapeHtml(doc.hora)}</strong>
    <strong>CHAVE DE ACESSO</strong>
    <div class="chave">${escapeHtml(formatChaveGroups(doc.chave))}</div>
    <span>Protocolo ${escapeHtml(doc.protocol || '-')}</span>
    <span>Ambiente: ${escapeHtml(FISCAL_CONFIG.ambiente)}</span>
  </div>
  <hr class="rule" />
  <div class="block">
    <strong>CONSUMIDOR</strong>
    <span>${escapeHtml(doc.cliente || 'Consumidor não identificado')}</span>
    ${doc.buyerDocument ? `<span>CPF/CNPJ: ${escapeHtml(doc.buyerDocument)}</span>` : ''}
  </div>
  <hr class="rule" />
  <table>
    <thead>
      <tr>
        <th>Qtd</th>
        <th class="num">Unit</th>
        <th class="num">Total</th>
        <th class="num">Desc.</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <hr class="rule" />
  <div class="row"><span>Qtde. itens</span><span>${doc.items.length}</span></div>
  <div class="row"><span>Valor produtos</span><span>${money(itemsGross)}</span></div>
  ${
    discountTotal > 0
      ? `<div class="row"><span>Descontos</span><span>−${money(discountTotal)}</span></div>`
      : ''
  }
  <div class="total"><span>TOTAL A PAGAR</span><span>${money(doc.valor)}</span></div>
  ${payRows ? `<hr class="rule" /><div><strong>FORMA DE PAGAMENTO</strong>${payRows}</div>` : ''}
  <hr class="rule" />
  <div class="qr-trib">
    ${qrBlock}
    <div class="trib">
      <strong>Tributos totais incidentes</strong><br />
      (Lei Federal 12.741/2012)<br />
      Valor approx.: ${money(tribApprox)}
    </div>
  </div>
  <div class="badge">CUPOM NFC-e</div>
  <div class="muted" style="margin-top:6px;text-align:center">Ref. ${escapeHtml(doc.saleRef)}</div>
</body>
</html>`
}
