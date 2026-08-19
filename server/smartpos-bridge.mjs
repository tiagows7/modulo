/**
 * Ponte local SmartPOS — lógica Delphi, persistência Supabase.
 *
 * Fontes:
 *  - untSrvMetodosAbastecimentos.pas  (live via Supabase)
 *  - untSrvMetodosGerais.pas          (stubs de venda)
 *
 * Pré-requisito: rodar server/smartpos/supabase-schema.sql no projeto Supabase
 * e definir SMARTPOS_SUPABASE_KEY (anon/service_role).
 *
 * Uso: npm run smartpos-bridge
 */
import http from 'node:http'
import { URL } from 'node:url'
import { SMARTPOS_BRIDGE } from './smartpos/config.mjs'
import { pingSupabase } from './smartpos/supabase.mjs'
import {
  listarAbastecimentos,
  updateAbastecimento,
} from './smartpos/abastecimentos.mjs'
import { vendaStubs } from './smartpos/venda-stubs.mjs'

const BRIDGE_PORT = SMARTPOS_BRIDGE.port

/** @type {Map<string, { terminalId: string, lastSeen: string, meta?: unknown }>} */
const terminals = new Map()

function nowIso() {
  return new Date().toISOString()
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Terminal-Id',
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

function httpStatusFromCode(code, fallback = 200) {
  if (code === 200) return 200
  if (code === 300) return 409
  if (code === 400) return 400
  if (code === 501) return 501
  return fallback
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, { ok: true })
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${BRIDGE_PORT}`)

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const db = await pingSupabase()
      sendJson(res, {
        ok: db.ok,
        mode: SMARTPOS_BRIDGE.mode,
        bridge: 'smartpos',
        port: BRIDGE_PORT,
        terminals: terminals.size,
        supabase: {
          url: SMARTPOS_BRIDGE.supabase.url,
          keyConfigured: Boolean(SMARTPOS_BRIDGE.supabase.key),
          tables: SMARTPOS_BRIDGE.tables,
          ...db,
        },
        message: db.ok
          ? 'SmartPOS bridge — abastecimentos via Supabase.'
          : `Supabase: ${db.error}`,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/smartpos/ping') {
      const body = await readBody(req)
      const terminalId = String(
        body.terminalId || req.headers['x-terminal-id'] || '',
      ).trim()
      if (!terminalId) {
        sendJson(res, { error: 'Informe terminalId.' }, 400)
        return
      }
      const entry = {
        terminalId,
        lastSeen: nowIso(),
        meta: body.meta ?? null,
      }
      terminals.set(terminalId, entry)
      sendJson(res, { ok: true, ...entry })
      return
    }

    if (req.method === 'GET' && url.pathname === '/smartpos/terminals') {
      sendJson(res, [...terminals.values()])
      return
    }

    if (req.method === 'GET' && url.pathname === '/smartpos/abastecimentos') {
      const result = await listarAbastecimentos({
        bico: url.searchParams.get('bico') || url.searchParams.get('bomba') || '',
        operador: url.searchParams.get('operador') || '',
      })
      sendJson(res, result, httpStatusFromCode(result.code, result.ok ? 200 : 409))
      return
    }

    if (req.method === 'POST' && url.pathname === '/smartpos/abastecimentos/update') {
      const body = await readBody(req)
      const result = await updateAbastecimento({
        tipo: body.tipo,
        bico: body.bico || body.bomba,
        numero: body.numero,
        nsu: body.nsu || body.cartaNsu,
        hora: body.hora || body.cartaoHora,
        pdv: body.pdv,
      })
      sendJson(res, result, httpStatusFromCode(result.code, result.ok ? 200 : 409))
      return
    }

    const claimMatch = url.pathname.match(
      /^\/smartpos\/abastecimentos\/([^/]+)\/(claim|baixar|release)$/,
    )
    if (req.method === 'POST' && claimMatch) {
      const id = decodeURIComponent(claimMatch[1])
      const action = claimMatch[2]
      const body = await readBody(req)
      const [bico, numeroStr] = id.includes('-')
        ? [id.slice(0, id.lastIndexOf('-')), id.slice(id.lastIndexOf('-') + 1)]
        : [body.bico || body.bomba, body.numero]
      const tipo = action === 'claim' ? 0 : action === 'baixar' ? 1 : 2
      const result = await updateAbastecimento({
        tipo,
        bico,
        numero: Number(numeroStr ?? body.numero),
        nsu: body.nsu || body.cartaNsu,
        hora: body.hora || body.cartaoHora,
        pdv: body.pdv,
      })
      sendJson(res, result, httpStatusFromCode(result.code, result.ok ? 200 : 409))
      return
    }

    // Venda stubs
    if (req.method === 'GET' && url.pathname === '/smartpos/echo') {
      sendJson(res, vendaStubs.echo(url.searchParams.get('value') || ''))
      return
    }
    if (req.method === 'GET' && url.pathname === '/smartpos/terminal') {
      sendJson(res, vendaStubs.terminal(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/configuraterminal') {
      sendJson(res, vendaStubs.configuraterminal(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/venda/produto') {
      sendJson(res, vendaStubs.updateGravaProduto(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/venda/dinheiro') {
      sendJson(res, vendaStubs.updateDinheiro(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/venda/cartao') {
      sendJson(res, vendaStubs.updateCartao(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/venda/cancela-cartao') {
      sendJson(res, vendaStubs.updateCancelaCartao(), 501)
      return
    }
    if (req.method === 'GET' && url.pathname === '/smartpos/produto') {
      sendJson(res, vendaStubs.consultaProduto(), 501)
      return
    }
    if (req.method === 'GET' && url.pathname === '/smartpos/cliente') {
      sendJson(res, vendaStubs.cliente(), 501)
      return
    }
    if (req.method === 'POST' && url.pathname === '/smartpos/confirmacupom') {
      sendJson(res, vendaStubs.confirmacupom(), 501)
      return
    }

    sendJson(res, { error: 'Rota não encontrada' }, 404)
  } catch (err) {
    sendJson(
      res,
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Erro na ponte SmartPOS',
      },
      err?.status && err.status < 600 ? err.status : 500,
    )
  }
})

server.listen(BRIDGE_PORT, '0.0.0.0', () => {
  console.log(`[SmartPOS Bridge] http://127.0.0.1:${BRIDGE_PORT}`)
  console.log(`[SmartPOS Bridge] Modo: ${SMARTPOS_BRIDGE.mode}`)
  console.log(`[SmartPOS Bridge] Supabase: ${SMARTPOS_BRIDGE.supabase.url}`)
  console.log(
    `[SmartPOS Bridge] Key: ${SMARTPOS_BRIDGE.supabase.key ? 'configurada' : 'AUSENTE (SMARTPOS_SUPABASE_KEY)'}`,
  )
  console.log(
    '[SmartPOS Bridge] Schema SQL: server/smartpos/supabase-schema.sql',
  )
})
