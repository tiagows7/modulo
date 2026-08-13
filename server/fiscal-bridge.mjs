/**
 * Ponte local fiscal (NFC-e / NF-e) — preparada para SEFAZ/ACBr.
 *
 * PDV (HTTP) → 127.0.0.1:39102 → motor mock (hoje) / provedor live (futuro)
 *
 * Uso:
 *   npm run fiscal-bridge
 *
 * Endpoints:
 *   GET  /health
 *   POST /fiscal/emit
 *   POST /fiscal/send
 *   POST /fiscal/print
 *   GET  /fiscal/documents
 *   GET  /fiscal/documents/:id
 */
import http from 'node:http'
import { URL } from 'node:url'
import { randomBytes } from 'node:crypto'
import { buildEscPosReceipt } from './escpos-receipt.mjs'
import {
  getDefaultPrinterName,
  listPrinterNames,
  printRaw,
  resolvePrinterName,
} from './raw-printer.mjs'

const BRIDGE_PORT = 39102
const MODE = process.env.FISCAL_MODE || 'mock'
/** Impressão RAW/ESC/POS sem diálogo do Windows (estilo ACBr). */
const DIRECT_PRINT = String(process.env.FISCAL_DIRECT_PRINT ?? '1') !== '0'
/** Preferir a fila saudável; "ELGIN i8" às vezes fica em PendingDeletion. */
const PRINTER_NAME = process.env.FISCAL_PRINTER_NAME || 'ELGIN i8 (copy 1)'

const EMITTER = {
  razaoSocial: 'POSTO DEMO PDV LTDA',
  nomeFantasia: 'Posto Demo',
  cnpj: '00.000.000/0001-00',
  ie: 'ISENTO',
}

/** @typedef {'NFC-e' | 'NF-e'} DocTipo */

/**
 * @typedef {{
 *   id: string
 *   tipo: DocTipo
 *   numero: string
 *   serie: string
 *   chave: string
 *   emissao: string
 *   hora: string
 *   valor: number
 *   cliente: string
 *   status: string
 *   saleRef: string
 *   issuedAt: string
 *   protocol?: string
 *   buyerDocument?: string
 *   buyerEmail?: string
 *   items: any[]
 *   payments: any[]
 *   xml?: string
 *   sentAt?: string
 *   sentTo?: string
 * }} FiscalDoc
 */

/** @type {FiscalDoc[]} */
const documents = []
let seqNfce = 1000
let seqNfe = 100

function nowIso() {
  return new Date().toISOString()
}

function pad(n, size) {
  return String(n).padStart(size, '0')
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function suggestTipo(buyer) {
  const digits = onlyDigits(buyer?.document)
  if (digits.length === 14) return 'NF-e'
  if (String(buyer?.ie || '').trim() && digits.length >= 11) return 'NF-e'
  return 'NFC-e'
}

function buildChave(tipo, numero) {
  const uf = '35'
  const d = new Date()
  const aamm = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}`
  const cnpj = onlyDigits(EMITTER.cnpj).padStart(14, '0').slice(0, 14)
  const mod = tipo === 'NFC-e' ? '65' : '55'
  const serie = '001'
  const nNF = pad(numero, 9)
  const tpEmis = '1'
  const cNF = pad(parseInt(randomBytes(4).toString('hex').slice(0, 8), 16) % 1e8, 8)
  const base = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  const dv = String([...base].reduce((s, c) => s + Number(c), 0) % 10)
  return `${base}${dv}`
}

function findDoc(idOrChave) {
  const key = String(idOrChave || '').trim()
  return documents.find((d) => d.id === key || d.chave === key) || null
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function emitDoc(payload) {
  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.length) {
    const err = new Error('Informe ao menos um item para emitir a nota.')
    err.status = 400
    throw err
  }
  const tipo = payload.tipo || suggestTipo(payload.buyer)
  const total =
    payload.total != null
      ? Math.round(Number(payload.total) * 100) / 100
      : Math.round(items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0) * 100) / 100

  const numeroInt = tipo === 'NFC-e' ? seqNfce++ : seqNfe++
  const now = new Date()
  const doc = {
    id: `doc-${Date.now()}-${randomBytes(3).toString('hex')}`,
    tipo,
    numero: pad(numeroInt, 6),
    serie: '1',
    chave: buildChave(tipo, numeroInt),
    emissao: now.toLocaleDateString('pt-BR'),
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    valor: total,
    cliente:
      payload.buyer?.name?.trim() ||
      payload.buyer?.customerCode?.trim() ||
      (tipo === 'NFC-e' ? 'Consumidor final' : 'Destinatário não informado'),
    status: 'authorized',
    saleRef: payload.saleRef || `PDV${pad(numeroInt, 6)}`,
    issuedAt: nowIso(),
    protocol: `135${pad(numeroInt, 12)}`,
    buyerDocument: payload.buyer?.document,
    buyerEmail: payload.buyer?.email,
    items,
    payments: Array.isArray(payload.payments) ? payload.payments : [],
    xml: `<!-- XML mock ${tipo} ${pad(numeroInt, 6)} -->`,
  }
  documents.unshift(doc)
  return {
    document: doc,
    message: `${doc.tipo} ${doc.numero} autorizada (bridge mock).`,
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, { ok: true })
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${BRIDGE_PORT}`)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      let printer = null
      try {
        printer = resolvePrinterName(PRINTER_NAME)
      } catch {
        printer = null
      }
      sendJson(res, {
        ok: true,
        mode: MODE,
        directPrint: DIRECT_PRINT,
        printerName: printer,
        message:
          MODE === 'mock'
            ? 'Ponte fiscal mock — emissão/envio simulados; impressão RAW disponível.'
            : 'Ponte fiscal live (configure provedor SEFAZ).',
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/fiscal/printers') {
      sendJson(res, {
        ok: true,
        printers: listPrinterNames(),
        defaultPrinter: getDefaultPrinterName(),
        configured: PRINTER_NAME,
        directPrint: DIRECT_PRINT,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/fiscal/emit') {
      const body = await readBody(req)
      sendJson(res, emitDoc(body))
      return
    }

    if (req.method === 'POST' && url.pathname === '/fiscal/send') {
      const body = await readBody(req)
      const doc = findDoc(body.documentId)
      if (!doc) {
        sendJson(res, { error: 'Documento não encontrado para envio.' }, 404)
        return
      }
      if (doc.tipo !== 'NF-e') {
        sendJson(res, { error: 'Envio ao destinatário aplica-se apenas à NF-e.' }, 400)
        return
      }
      const sentTo = body.email || doc.buyerEmail || 'destinatario@empresa.local'
      doc.sentAt = nowIso()
      doc.sentTo = sentTo
      sendJson(res, {
        ok: true,
        documentId: doc.id,
        sentTo,
        sentAt: doc.sentAt,
        message: `NF-e ${doc.numero} enviada para ${sentTo} (bridge mock).`,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/fiscal/print') {
      const body = await readBody(req)
      const doc = body.documentId ? findDoc(body.documentId) : null

      // Texto completo pode vir do PDV (cupom montado no front) ou fallback do doc na ponte.
      let text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text && doc) {
        text = [
          `${EMITTER.nomeFantasia}`,
          `${doc.tipo} Nº ${doc.numero} Série ${doc.serie}`,
          `TOTAL ${doc.valor.toFixed(2)}`,
          `Chave ${doc.chave}`,
          'Cupom NFC-e / DANFE',
        ].join('\n')
      }
      if (!text) {
        sendJson(
          res,
          { error: 'Informe text ou documentId com conteúdo para impressão.' },
          400,
        )
        return
      }

      const model = body.model || (doc?.tipo === 'NFC-e' ? 'non_fiscal' : 'simplified')
      const html =
        typeof body.html === 'string' && body.html.trim()
          ? body.html
          : `<pre>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`
      const qrPayload =
        typeof body.qrPayload === 'string' && body.qrPayload.trim()
          ? body.qrPayload.trim()
          : undefined
      const printerName = body.printerName || PRINTER_NAME
      const wantDirect =
        body.direct === true || (body.direct !== false && DIRECT_PRINT && body.openDialog !== true)

      if (wantDirect) {
        const buffer = buildEscPosReceipt({
          text,
          qrPayload,
          cut: body.cut !== false,
        })
        const printed = printRaw(buffer, {
          printerName,
          docName: doc
            ? `${doc.tipo} ${doc.numero}`
            : body.docName || 'PDV Cupom',
        })
        sendJson(res, {
          ok: true,
          documentId: doc?.id || body.documentId || null,
          model,
          text,
          html,
          printerName: printed.printerName,
          bytes: printed.bytes,
          direct: true,
          message: `Cupom enviado direto para "${printed.printerName}" (${printed.bytes} bytes).`,
        })
        return
      }

      sendJson(res, {
        ok: true,
        documentId: doc?.id || body.documentId || null,
        model,
        text,
        html,
        direct: false,
        message: doc
          ? `Prévia ${doc.tipo} nº ${doc.numero} (sem envio à impressora).`
          : 'Prévia gerada (sem envio à impressora).',
      })
      return
    }

    if (req.method === 'GET' && url.pathname === '/fiscal/documents') {
      const tipo = url.searchParams.get('tipo')
      const q = (url.searchParams.get('q') || '').toLowerCase()
      const status = url.searchParams.get('status')
      const list = documents.filter((doc) => {
        if (tipo && tipo !== 'Todos' && doc.tipo !== tipo) return false
        if (status && doc.status !== status) return false
        if (!q) return true
        return (
          doc.numero.includes(q) ||
          doc.chave.includes(q) ||
          doc.cliente.toLowerCase().includes(q) ||
          doc.tipo.toLowerCase().includes(q)
        )
      })
      sendJson(res, list)
      return
    }

    const docMatch = url.pathname.match(/^\/fiscal\/documents\/([^/]+)$/)
    if (req.method === 'GET' && docMatch) {
      const doc = findDoc(decodeURIComponent(docMatch[1]))
      if (!doc) {
        sendJson(res, { error: 'Documento não encontrado.' }, 404)
        return
      }
      sendJson(res, doc)
      return
    }

    sendJson(res, { error: 'Rota não encontrada' }, 404)
  } catch (err) {
    sendJson(
      res,
      { error: err instanceof Error ? err.message : 'Erro na ponte fiscal' },
      err?.status || 500,
    )
  }
})

server.listen(BRIDGE_PORT, '127.0.0.1', () => {
  let printerLabel = PRINTER_NAME
  try {
    printerLabel = resolvePrinterName(PRINTER_NAME)
  } catch (err) {
    printerLabel = `(não resolvida: ${err instanceof Error ? err.message : err})`
  }
  console.log(`[Fiscal Bridge] http://127.0.0.1:${BRIDGE_PORT}`)
  console.log(`[Fiscal Bridge] Modo: ${MODE}`)
  console.log(`[Fiscal Bridge] Impressão direta: ${DIRECT_PRINT ? 'SIM' : 'NÃO'} → ${printerLabel}`)
  console.log(
    '[Fiscal Bridge] Endpoints: /health · /fiscal/printers · POST /fiscal/emit|send|print · GET /fiscal/documents',
  )
})
