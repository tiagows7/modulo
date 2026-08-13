import { FISCAL_CONFIG } from './config'
import { printHtmlDocument } from './printHtml'
import type { FiscalDocument, FiscalPrintModel } from './types'

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

/**
 * Texto térmico / DANFE modelo simplificado (NF-e).
 */
export function buildSimplifiedDanfeText(doc: FiscalDocument): string {
  const em = FISCAL_CONFIG.emitter
  const lines: string[] = [
    em.nomeFantasia || em.razaoSocial,
    em.razaoSocial,
    `CNPJ ${em.cnpj}  IE ${em.ie}`,
    `${em.endereco} - ${em.bairro}`,
    `${em.cidade}/${em.uf}  CEP ${em.cep}`,
    em.telefone,
    '--------------------------------',
    `${doc.tipo}  Nº ${doc.numero}  Série ${doc.serie}`,
    `Emissão ${doc.emissao} ${doc.hora}`,
    `Protocolo ${doc.protocol || '-'}`,
    `Ambiente: ${FISCAL_CONFIG.ambiente}`,
    '--------------------------------',
    `Destinatário: ${doc.cliente}`,
  ]

  if (doc.buyerDocument) lines.push(`CPF/CNPJ: ${doc.buyerDocument}`)
  lines.push('--------------------------------')
  lines.push('ITEM  QTD  VL UNIT  TOTAL')

  for (const item of doc.items) {
    const total = item.qty * item.price
    lines.push(item.name)
    lines.push(
      `  ${item.qty} ${item.unit} x ${money(item.price)} = ${money(total)}`,
    )
  }

  lines.push('--------------------------------')
  lines.push(`TOTAL ${money(doc.valor)}`)

  if (doc.payments.length > 0) {
    lines.push('Pagamentos:')
    for (const p of doc.payments) {
      lines.push(`  ${p.label || p.methodId}: ${money(p.amount)}`)
    }
  }

  lines.push('--------------------------------')
  lines.push('Chave de acesso')
  lines.push(formatChaveGroups(doc.chave))
  lines.push('--------------------------------')
  lines.push('Consulta via chave / QR (NF-e)')
  lines.push('DANFE NF-e — modelo simplificado')
  lines.push(`Ref. venda: ${doc.saleRef}`)

  return lines.join('\n')
}

/**
 * HTML do DANFE em modelo simplificado (NF-e).
 */
export function buildSimplifiedDanfeHtml(
  doc: FiscalDocument,
  model: FiscalPrintModel = 'simplified',
): string {
  void model
  const em = FISCAL_CONFIG.emitter
  const itemsRows = doc.items
    .map((item) => {
      const total = item.qty * item.price
      return `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.qty} ${escapeHtml(item.unit)}</td>
        <td class="num">${money(item.price)}</td>
        <td class="num">${money(total)}</td>
      </tr>`
    })
    .join('')

  const payRows = doc.payments
    .map(
      (p) =>
        `<div class="pay-line"><span>${escapeHtml(p.label || p.methodId)}</span><strong>${money(p.amount)}</strong></div>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.tipo)} ${escapeHtml(doc.numero)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: "Segoe UI", Consolas, monospace;
      font-size: 12px;
      color: #111;
      width: 80mm;
    }
    h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
    .muted { color: #444; text-align: center; line-height: 1.35; }
    .rule { border: none; border-top: 1px dashed #333; margin: 8px 0; }
    .meta { display: grid; gap: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 0; vertical-align: top; }
    th { text-align: left; border-bottom: 1px solid #333; font-size: 11px; }
    .num { text-align: right; white-space: nowrap; }
    .total { font-size: 15px; font-weight: 700; display: flex; justify-content: space-between; }
    .chave { font-size: 10px; word-break: break-all; letter-spacing: 0.02em; }
    .pay-line { display: flex; justify-content: space-between; gap: 8px; }
    .badge { text-align: center; font-weight: 700; margin-top: 6px; }
    @media print {
      body { width: auto; padding: 0; }
      @page { margin: 6mm; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(em.nomeFantasia || em.razaoSocial)}</h1>
  <div class="muted">
    ${escapeHtml(em.razaoSocial)}<br />
    CNPJ ${escapeHtml(em.cnpj)} · IE ${escapeHtml(em.ie)}<br />
    ${escapeHtml(em.endereco)} — ${escapeHtml(em.bairro)}<br />
    ${escapeHtml(em.cidade)}/${escapeHtml(em.uf)} · CEP ${escapeHtml(em.cep)}
  </div>
  <hr class="rule" />
  <div class="meta">
    <strong>NF-e nº ${escapeHtml(doc.numero)} — Série ${escapeHtml(doc.serie)}</strong>
    <span>Emissão ${escapeHtml(doc.emissao)} ${escapeHtml(doc.hora)}</span>
    <span>Protocolo ${escapeHtml(doc.protocol || '-')}</span>
    <span>Ambiente: ${escapeHtml(FISCAL_CONFIG.ambiente)}</span>
  </div>
  <hr class="rule" />
  <div>
    <strong>Destinatário</strong><br />
    ${escapeHtml(doc.cliente)}
    ${doc.buyerDocument ? `<br />CPF/CNPJ: ${escapeHtml(doc.buyerDocument)}` : ''}
  </div>
  <hr class="rule" />
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="num">Qtd</th>
        <th class="num">Unit</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <hr class="rule" />
  <div class="total"><span>TOTAL</span><span>${money(doc.valor)}</span></div>
  ${payRows ? `<hr class="rule" /><div>${payRows}</div>` : ''}
  <hr class="rule" />
  <div><strong>Chave de acesso</strong></div>
  <div class="chave">${escapeHtml(formatChaveGroups(doc.chave))}</div>
  <div class="badge">DANFE NF-e — modelo simplificado</div>
  <div class="muted" style="margin-top:6px">Ref. ${escapeHtml(doc.saleRef)}</div>
</body>
</html>`
}

/**
 * Abre visualização do DANFE simplificado no modal interno do PDV.
 * Usa callback global em window (evita falha com HMR / módulos duplicados).
 */
type PreviewOpener = (html: string) => boolean

declare global {
  interface Window {
    __pdvOpenDocPreview?: PreviewOpener
  }
}

/** Registra o modal interno; retorna cleanup. */
export function registerDocumentPreviewOpener(opener: PreviewOpener): () => void {
  window.__pdvOpenDocPreview = opener
  return () => {
    if (window.__pdvOpenDocPreview === opener) {
      delete window.__pdvOpenDocPreview
    }
  }
}

export function openSimplifiedPreview(html: string, options?: { autoPrint?: boolean }): boolean {
  const autoPrint = Boolean(options?.autoPrint)
  const content = String(html || '').trim()
  if (!content) return false

  const opener = window.__pdvOpenDocPreview
  if (opener) {
    const ok = opener(content)
    if (ok && autoPrint) {
      window.setTimeout(() => {
        void printHtmlDocument(content)
      }, 400)
    }
    if (ok) return true
  }

  // Fallback: evento (PreviewProvider escuta e abre o modal).
  window.dispatchEvent(
    new CustomEvent('pdv:open-doc-preview', { detail: { html: content, autoPrint } }),
  )
  return true
}

/** @deprecated Preferir openSimplifiedPreview — mantido para compatibilidade. */
export function openSimplifiedPrintDialog(html: string): boolean {
  return openSimplifiedPreview(html, { autoPrint: false })
}
