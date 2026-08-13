/**
 * Ponte local TEF (CliSiTef / Fiserv)
 *
 * PDV (HTTP) → 127.0.0.1:39101 → CliSiTef64I.dll / pinpad
 *
 * Modo mock: simula débito, crédito e PIX (QR) sem DLL.
 * Modo live: CliSiTef64I.dll em server/clisitef64/
 *
 * Uso:
 *   npm run tef-bridge              # mock
 *   set TEF_MODE=live&& npm run tef-bridge
 */
import http from 'node:http'
import { URL } from 'node:url'
import { randomBytes } from 'node:crypto'
import {
  configureCliSiTef,
  finalizeCliSiTefTransaction,
  isCliSiTefBusy,
  isCliSiTefReady,
  runCliSiTefTransaction,
  submitCliSiTefInput,
  requestCliSiTefGoBack,
  CLISITEF_PATHS,
} from './clisitef-live.mjs'

const BRIDGE_PORT = 39101
const DEFAULT_MODE = process.env.TEF_MODE || 'mock'

const SITEF_CFG = {
  sitefIp: process.env.SITEF_IP || '192.168.1.7',
  storeId: process.env.SITEF_LOJA || '00000000',
  terminalId: process.env.SITEF_TERMINAL || 'PDV0002',
}

/** @typedef {'tef' | 'pix'} TefMethod */
/** @typedef {'idle' | 'starting' | 'waiting_card' | 'waiting_pin' | 'waiting_pix' | 'processing' | 'approved' | 'denied' | 'cancelled' | 'error'} TefStatus */

/**
 * @typedef {{
 *   transactionId: string
 *   method: TefMethod
 *   amount: number
 *   status: TefStatus
 *   message: string
 *   pixQrPayload?: string | null
 *   nsu?: string | null
 *   authorizationCode?: string | null
 *   brand?: string | null
 *   receiptCustomer?: string | null
 *   receiptMerchant?: string | null
 *   error?: string | null
 *   updatedAt: string
 *   cupom: string
 *   operator: string
 *   functionId: number
 *   startedAt: number
 *   confirmed?: boolean
 *   cancelled?: boolean
 * }} TefTx
 */

/** @type {Map<string, TefTx>} */
const transactions = new Map()

const METHOD_FUNCTION = {
  /** Menu completo de vendas CliSiTef (exemplo oficial função 0). */
  tef: 0,
  pix: 122,
}

function nowIso() {
  return new Date().toISOString()
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

/**
 * @param {http.IncomingMessage} req
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function formatAmountBr(amount) {
  return amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * @param {TefTx} tx
 */
function advanceMock(tx) {
  if (tx.cancelled || tx.confirmed) return tx
  if (
    tx.status === 'approved' ||
    tx.status === 'denied' ||
    tx.status === 'cancelled' ||
    tx.status === 'error'
  ) {
    return tx
  }

  const elapsed = Date.now() - tx.startedAt

  if (tx.method === 'pix') {
    if (elapsed < 600) {
      tx.status = 'starting'
      tx.message = 'Iniciando PIX (carteira digital)…'
    } else if (elapsed < 1800) {
      tx.status = 'waiting_pix'
      tx.message = 'Exiba o QR Code para o cliente'
      tx.pixQrPayload =
        tx.pixQrPayload ||
        `00020126580014BR.GOV.BCB.PIX0136${tx.transactionId}520400005303986540${formatAmountBr(tx.amount).replace(',', '')}5802BR5925PDV POSTO MOCK6009SAO PAULO62070503***6304ABCD`
    } else if (elapsed < 4500) {
      tx.status = 'waiting_pix'
      tx.message = 'Aguardando pagamento do PIX…'
    } else {
      tx.status = 'approved'
      tx.message = 'PIX aprovado'
      tx.nsu = String(Math.floor(100000 + Math.random() * 899999))
      tx.authorizationCode = String(Math.floor(100000 + Math.random() * 899999))
      tx.brand = 'PIX'
      tx.receiptCustomer = `PIX APROVADO\nNSU ${tx.nsu}\nAUT ${tx.authorizationCode}\nR$ ${formatAmountBr(tx.amount)}`
      tx.receiptMerchant = tx.receiptCustomer
    }
  } else {
    // Função 0 (menu TEF) ou demais cartões via pinpad
    if (elapsed < 500) {
      tx.status = 'starting'
      tx.message = 'Abrindo opções de venda no pinpad…'
    } else if (elapsed < 2000) {
      tx.status = 'waiting_card'
      tx.message = 'Selecione a opção no pinpad / aproxime o cartão'
    } else if (elapsed < 3500) {
      tx.status = 'waiting_pin'
      tx.message = 'Digite a senha no pinpad'
    } else if (elapsed < 4800) {
      tx.status = 'processing'
      tx.message = 'Autorizando no SiTef…'
    } else {
      tx.status = 'approved'
      tx.message = 'TEF aprovado'
      tx.nsu = String(Math.floor(100000 + Math.random() * 899999))
      tx.authorizationCode = String(Math.floor(100000 + Math.random() * 899999))
      tx.brand = 'TEF'
      tx.receiptCustomer = `TEF APROVADO\nNSU ${tx.nsu}\nAUT ${tx.authorizationCode}\nR$ ${formatAmountBr(tx.amount)}`
      tx.receiptMerchant = tx.receiptCustomer
    }
  }

  tx.updatedAt = nowIso()
  return tx
}

/**
 * @param {TefTx} tx
 */
function publicState(tx) {
  return {
    transactionId: tx.transactionId,
    method: tx.method,
    amount: tx.amount,
    status: tx.status,
    message: tx.message,
    pixQrPayload: tx.pixQrPayload ?? null,
    nsu: tx.nsu ?? null,
    authorizationCode: tx.authorizationCode ?? null,
    brand: tx.brand ?? null,
    receiptCustomer: tx.receiptCustomer ?? null,
    receiptMerchant: tx.receiptMerchant ?? null,
    error: tx.error ?? null,
    menuTitle: tx.menuTitle ?? null,
    menuOptions: tx.menuOptions ?? null,
    fieldPrompt: tx.fieldPrompt ?? null,
    updatedAt: tx.updatedAt,
  }
}

/**
 * @param {object} body
 */
function startLive(body) {
  if (!isCliSiTefReady()) {
    const id = `LIVE-${randomBytes(4).toString('hex').toUpperCase()}`
    /** @type {TefTx} */
    const tx = {
      transactionId: id,
      method: body.method,
      amount: Number(body.amount),
      status: 'error',
      message: `CliSiTef64I.dll não encontrada em ${CLISITEF_PATHS.dir}`,
      error: `Copie CliSiTef64I.dll, libcurl64.dll, libemv64.dll, QREncode64.dll e CliSiTef.ini para ${CLISITEF_PATHS.dir}`,
      updatedAt: nowIso(),
      cupom: String(body.cupom || ''),
      operator: String(body.operator || 'CAIXA'),
      functionId: METHOD_FUNCTION[body.method] ?? 0,
      startedAt: Date.now(),
    }
    transactions.set(id, tx)
    return tx
  }

  if (isCliSiTefBusy()) {
    const id = `LIVE-${randomBytes(4).toString('hex').toUpperCase()}`
    /** @type {TefTx} */
    const tx = {
      transactionId: id,
      method: body.method,
      amount: Number(body.amount),
      status: 'error',
      message: 'TEF ocupado — aguarde a transação atual',
      error: 'TEF ocupado',
      updatedAt: nowIso(),
      cupom: String(body.cupom || ''),
      operator: String(body.operator || 'CAIXA'),
      functionId: METHOD_FUNCTION[body.method] ?? 0,
      startedAt: Date.now(),
    }
    transactions.set(id, tx)
    return tx
  }

  const id = `LIVE-${randomBytes(4).toString('hex').toUpperCase()}`
  /** @type {TefTx} */
  const tx = {
    transactionId: id,
    method: body.method,
    amount: Number(body.amount),
    status: 'starting',
    message: 'Iniciando CliSiTef64…',
    updatedAt: nowIso(),
    cupom: String(body.cupom || `PDV${Date.now().toString().slice(-6)}`),
    operator: String(body.operator || 'CAIXA'),
    functionId: METHOD_FUNCTION[body.method] ?? 0,
    startedAt: Date.now(),
    pixQrPayload: null,
  }
  transactions.set(id, tx)

  void runCliSiTefTransaction(tx, SITEF_CFG)
  return tx
}

/**
 * @param {object} body
 */
function startMock(body) {
  const id = `MOCK-${randomBytes(4).toString('hex').toUpperCase()}`
  /** @type {TefTx} */
  const tx = {
    transactionId: id,
    method: body.method,
    amount: Number(body.amount),
    status: 'starting',
    message: 'Iniciando TEF…',
    updatedAt: nowIso(),
    cupom: String(body.cupom || `PDV${Date.now().toString().slice(-6)}`),
    operator: String(body.operator || 'CAIXA'),
    functionId: METHOD_FUNCTION[body.method] ?? 0,
    startedAt: Date.now(),
    pixQrPayload: null,
  }
  transactions.set(id, tx)
  return advanceMock(tx)
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, { error: 'Requisição inválida' }, 400)
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, { ok: true })
    return
  }

  const url = new URL(req.url, `http://127.0.0.1:${BRIDGE_PORT}`)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const dllOk = isCliSiTefReady()
      sendJson(res, {
        ok: true,
        service: 'tef-bridge',
        mode: DEFAULT_MODE,
        clisitef: {
          ready: dllOk,
          path: CLISITEF_PATHS.dll,
          sitefIp: SITEF_CFG.sitefIp,
          storeId: SITEF_CFG.storeId,
          terminalId: SITEF_CFG.terminalId,
        },
        message:
          DEFAULT_MODE === 'mock'
            ? 'TEF mock online (débito / crédito / PIX)'
            : dllOk
              ? 'TEF live — CliSiTef64I.dll pronta'
              : 'TEF live — DLL ausente em server/clisitef64',
        port: BRIDGE_PORT,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/tef/pay') {
      const body = await readBody(req)
      const method = body.method
      if (!['tef', 'pix'].includes(method)) {
        sendJson(res, { error: 'Método TEF inválido. Use tef ou pix.' }, 400)
        return
      }
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        sendJson(res, { error: 'Valor inválido para TEF.' }, 400)
        return
      }

      const mode = body.mode || DEFAULT_MODE
      const tx = mode === 'live' ? startLive({ ...body, method, amount }) : startMock({ ...body, method, amount })
      console.log(
        `[TEF] start ${tx.method} R$ ${formatAmountBr(tx.amount)} cupom=${tx.cupom} id=${tx.transactionId} mode=${mode}`,
      )
      sendJson(res, publicState(tx), tx.status === 'error' ? 503 : 200)
      return
    }

    const statusMatch = url.pathname.match(/^\/tef\/status\/([^/]+)$/)
    if (req.method === 'GET' && statusMatch) {
      const id = decodeURIComponent(statusMatch[1])
      const tx = transactions.get(id)
      if (!tx) {
        sendJson(res, { error: 'Transação não encontrada' }, 404)
        return
      }
      if (id.startsWith('MOCK-') && !tx.cancelled && tx.status !== 'error') {
        advanceMock(tx)
      }
      sendJson(res, publicState(tx))
      return
    }

    const inputMatch = url.pathname.match(/^\/tef\/input\/([^/]+)$/)
    if (req.method === 'POST' && inputMatch) {
      const id = decodeURIComponent(inputMatch[1])
      const tx = transactions.get(id)
      if (!tx) {
        sendJson(res, { error: 'Transação não encontrada' }, 404)
        return
      }
      const body = await readBody(req)
      const value = body.value ?? body.option ?? body.menuOption
      if (value == null || String(value).trim() === '') {
        sendJson(res, { error: 'Informe value com a opção do menu.' }, 400)
        return
      }
      const result = submitCliSiTefInput(tx, String(value).trim())
      if (!result.ok) {
        sendJson(res, { error: result.error }, 400)
        return
      }
      console.log(`[TEF] input ${id} value=${String(value).trim()}`)
      sendJson(res, publicState(tx))
      return
    }

    const confirmMatch = url.pathname.match(/^\/tef\/confirm\/([^/]+)$/)
    if (req.method === 'POST' && confirmMatch) {
      const id = decodeURIComponent(confirmMatch[1])
      const tx = transactions.get(id)
      if (!tx) {
        sendJson(res, { error: 'Transação não encontrada' }, 404)
        return
      }
      if (tx.status !== 'approved') {
        sendJson(res, { error: 'Só é possível confirmar transação aprovada.' }, 400)
        return
      }

      // Live: FinalizaFuncaoSiTefInterativo(1) — FinishTransaction do Delphi.
      if (!id.startsWith('MOCK-')) {
        const fin = finalizeCliSiTefTransaction(id, 1)
        if (!fin.ok && !fin.already) {
          sendJson(
            res,
            {
              error:
                fin.error ||
                `FinalizaFuncaoSiTefInterativo falhou (rc=${fin.rc ?? '?'})`,
            },
            500,
          )
          return
        }
      }

      tx.confirmed = true
      tx.message = 'Transação confirmada'
      tx.updatedAt = nowIso()
      console.log(`[TEF] confirm ${id}`)
      sendJson(res, publicState(tx))
      return
    }

    const backMatch = url.pathname.match(/^\/tef\/back\/([^/]+)$/)
    if (req.method === 'POST' && backMatch) {
      const id = decodeURIComponent(backMatch[1])
      const tx = transactions.get(id)
      if (!tx) {
        sendJson(res, { error: 'Transação não encontrada' }, 404)
        return
      }
      if (id.startsWith('MOCK-')) {
        sendJson(res, { error: 'Voltar não disponível no modo mock.' }, 400)
        return
      }
      const result = requestCliSiTefGoBack(tx)
      if (!result.ok) {
        sendJson(res, { error: result.error }, 400)
        return
      }
      console.log(`[TEF] back ${id}`)
      sendJson(res, publicState(tx))
      return
    }

    const cancelMatch = url.pathname.match(/^\/tef\/cancel\/([^/]+)$/)
    if (req.method === 'POST' && cancelMatch) {
      const id = decodeURIComponent(cancelMatch[1])
      const tx = transactions.get(id)
      if (!tx) {
        sendJson(res, { error: 'Transação não encontrada' }, 404)
        return
      }

      // Aprovada sem confirm → desfaz (Finaliza 0). Em andamento → Continua -1 via tx.cancelled.
      if (!id.startsWith('MOCK-') && tx.status === 'approved' && !tx.confirmed) {
        finalizeCliSiTefTransaction(id, 0)
      }

      tx.cancelled = true
      if (tx.status === 'approved' && tx.confirmed) {
        tx.message = 'Cancelamento após confirmação — use cancelamento administrativo se necessário'
      } else {
        tx.status = 'cancelled'
        tx.message = 'Transação cancelada pelo operador'
      }
      tx.pixQrPayload = null
      tx.updatedAt = nowIso()
      console.log(`[TEF] cancel ${id}`)
      sendJson(res, publicState(tx))
      return
    }

    sendJson(res, { error: 'Rota não encontrada' }, 404)
  } catch (err) {
    sendJson(res, { error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

server.listen(BRIDGE_PORT, '127.0.0.1', () => {
  console.log(`[TEF Bridge] http://127.0.0.1:${BRIDGE_PORT}`)
  console.log(`[TEF Bridge] Modo: ${DEFAULT_MODE}`)
  console.log(
    `[TEF Bridge] CliSiTef64: ${isCliSiTefReady() ? 'DLL presente' : 'ausente'} → ${CLISITEF_PATHS.dll}`,
  )
  console.log(
    '[TEF Bridge] Endpoints: /health · POST /tef/pay · GET /tef/status/:id · POST /tef/input|confirm|back|cancel/:id',
  )

  if (DEFAULT_MODE === 'live' && isCliSiTefReady()) {
    // Configura em background para não travar o HTTP na subida.
    setImmediate(() => {
      try {
        configureCliSiTef(SITEF_CFG)
      } catch (err) {
        console.warn(
          '[TEF Bridge] Configura CliSiTef falhou na subida:',
          err instanceof Error ? err.message : err,
        )
      }
    })
  }
})
