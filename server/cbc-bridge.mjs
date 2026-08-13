/**
 * Ponte local Companytec CBC (protocolo socket — exemplos Java/Delphi + CBCManager)
 *
 * PDV (HTTP) → 127.0.0.1:39100 → TCP 192.168.1.150:1771
 *
 * Fluxo:
 *  1. Conecta TCP
 *  2. Sincroniza relógio (&Hddhhmm)
 *  3. Lê abastecimentos (&A67), guarda localmente e dá Incrementa (&I6F)
 *     — (&I) não responde frame; sem isso o CBC devolve sempre o mesmo
 *  4. Parseia string de abastecimento
 *
 * Uso: npm run cbc-bridge
 */
import http from 'node:http'
import net from 'node:net'
import { URL, pathToFileURL } from 'node:url'

const BRIDGE_PORT = 39100
const DEFAULT_HOST = process.env.CBC_HOST || '192.168.1.150'
const DEFAULT_PORT = Number(process.env.CBC_PORT || 1771)
const CONNECT_TIMEOUT_MS = 4000
const IO_TIMEOUT_MS = 2000

/** @type {{ host: string, port: number, connected: boolean, clockSynced: boolean, lastError: string | null, lastCheck: string | null, lastRaw: string | null }} */
const state = {
  host: DEFAULT_HOST,
  port: DEFAULT_PORT,
  connected: false,
  clockSynced: false,
  lastError: null,
  lastCheck: null,
  lastRaw: null,
}

/** @type {net.Socket | null} */
let session = null
/** @type {string} */
let rxBuffer = ''

/** Fila: um comando TCP por vez (polls HTTP concorrentes). */
let ioChain = Promise.resolve()

/** Abastecimentos já lidos do CBC (após Incrementa) aguardando o PDV. */
/** @type {Map<string, ReturnType<typeof parseSupplyFrame>>} */
const pendingSupplies = new Map()

/**
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
function withLock(fn) {
  const run = ioChain.then(fn, fn)
  ioChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/**
 * Checksum Companytec: soma dos code points, 2 hex à direita (ex.: &A → 67, &I → 6F).
 * @param {string} body sem parênteses
 */
function addChecksum(body) {
  let sum = 0
  for (let i = 0; i < body.length; i += 1) {
    sum += body.codePointAt(i) ?? 0
  }
  let hex = sum.toString(16).toUpperCase()
  if (hex.length < 2) hex = `0${hex}`
  if (hex.length > 2) hex = hex.slice(-2)
  return `(${body}${hex})`
}

/**
 * @param {Date} [now]
 */
function clockCommand(now = new Date()) {
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `(&H${dd}${hh}${mm})`
}

/**
 * @param {string} buf
 * @returns {{ frame: string | null, rest: string }}
 */
function extractFrame(buf) {
  const start = buf.indexOf('(')
  if (start < 0) return { frame: null, rest: '' }
  const end = buf.indexOf(')', start)
  if (end < 0) return { frame: null, rest: buf.slice(start) }
  return {
    frame: buf.slice(start, end + 1),
    rest: buf.slice(end + 1),
  }
}

/**
 * @param {string} digits
 * @param {string} virgula
 * @param {'volume' | 'price' | 'total'} kind
 */
function applyVirgula(digits, virgula, kind) {
  const clean = digits.replace(/\D/g, '')
  if (!clean) return 0

  // Preço unitário: sempre 3 casas após a vírgula (padrão combustível / código 3E·3A)
  if (kind === 'price') {
    if (clean.length <= 3) return Number(`0.${clean.padStart(3, '0')}`)
    return Number(`${clean.slice(0, -3)}.${clean.slice(-3)}`)
  }

  if (virgula === '3E' || virgula === '3A') {
    if (kind === 'volume' && clean.length >= 6) {
      const decimals = virgula === '3E' ? 3 : 2
      return Number(
        `${clean.slice(0, clean.length - decimals)}.${clean.slice(-decimals)}`,
      )
    }
    if (kind === 'total') {
      if (clean.length >= 6) return Number(`${clean.slice(0, -2)}.${clean.slice(-2)}`)
      if (clean.length === 4) return Number(`${clean.slice(0, 2)}.${clean.slice(2)}`)
    }
  }

  if (clean.length <= 2) return Number(`0.${clean.padStart(2, '0')}`)
  return Number(`${clean.slice(0, -2)}.${clean.slice(-2)}`)
}

/**
 * Layout observado no CBC real + putAbastGrid:
 * [2:8] total · [8:14] litros · [14:18] PU · [18:20] vírgula · [24:26] bico
 * [28:32] HHMM · [34:38] registro
 * @param {string} frame
 */
function parseSupplyFrame(frame) {
  const st = frame.trim()
  if (st.length < 28) return null

  const inner = st.slice(1, -1)
  if (
    inner === '0' ||
    inner === '&A' ||
    inner.startsWith('&A') ||
    inner === '&H' ||
    inner.startsWith('&H') ||
    inner.startsWith('&V') ||
    inner.startsWith('S') ||
    inner.startsWith('&S') ||
    inner.startsWith('REL')
  ) {
    return null
  }

  // Abastecimento começa com (A... — não (&A
  if (st[1] !== 'A' && st[1] !== 'a' && st[1] !== '#') {
    return null
  }

  const virgula = st.length >= 20 ? st.slice(18, 20) : '3E'
  const totalRaw = st.length >= 8 ? st.slice(2, 8) : ''
  const litersRaw = st.length >= 14 ? st.slice(8, 14) : ''
  const priceRaw = st.length >= 18 ? st.slice(14, 18) : ''
  const nozzleRaw = st.length >= 26 ? st.slice(24, 26) : ''
  const timeRaw = st.length >= 32 ? st.slice(28, 32) : ''
  const dayRaw = st.length >= 28 ? st.slice(26, 28) : ''
  const registro = st.length >= 38 ? st.slice(34, 38).replace(/\D/g, '') : ''

  // DT435: código de bico é hexadecimal (ex.: 04, 0A)
  const bicoCode = nozzleRaw.toUpperCase()
  const nozzle = Number.parseInt(bicoCode, 16)
  if (!Number.isFinite(nozzle) || nozzle <= 0) return null

  const liters = applyVirgula(litersRaw, virgula, 'volume')
  const unitPrice = applyVirgula(priceRaw, virgula, 'price')
  let total = applyVirgula(totalRaw, virgula, 'total')
  const computed = liters && unitPrice ? Number((liters * unitPrice).toFixed(2)) : 0
  if (!total || total < 0.05 || (computed > 0 && Math.abs(total - computed) / computed > 0.35)) {
    total = computed
  }

  const now = new Date()
  const dd = dayRaw && dayRaw !== '00' ? dayRaw : String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const date = `${dd}/${mm}/${yyyy}`
  const time =
    timeRaw.length === 4
      ? `${timeRaw.slice(0, 2)}:${timeRaw.slice(2, 4)}`
      : now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const supplyId = registro || `${nozzle}-${timeRaw}-${litersRaw}-${totalRaw}`

  return {
    supplyId: String(supplyId),
    nozzle,
    bicoCode,
    productCode: bicoCode,
    liters,
    unitPrice,
    total,
    status: /** @type {'disponivel'} */ ('disponivel'),
    virgula,
    date,
    time,
    raw: st,
  }
}

/**
 * @returns {Promise<net.Socket>}
 */
function ensureSession(host, port) {
  return new Promise((resolve, reject) => {
    if (session && !session.destroyed && session.writable) {
      resolve(session)
      return
    }

    const socket = new net.Socket()
    let settled = false

    const fail = (err) => {
      if (settled) return
      settled = true
      cleanupSession()
      reject(err instanceof Error ? err : new Error(String(err)))
    }

    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.once('connect', () => {
      settled = true
      socket.setTimeout(0)
      session = socket
      rxBuffer = ''
      socket.on('data', (chunk) => {
        rxBuffer += chunk.toString('ascii')
      })
      socket.on('error', (err) => {
        state.lastError = err.message
        cleanupSession()
      })
      socket.on('close', () => {
        cleanupSession()
      })
      resolve(socket)
    })
    socket.once('timeout', () => fail(new Error(`Timeout ao conectar ${host}:${port}`)))
    socket.once('error', fail)
    socket.connect({ host, port, family: 4 })
  })
}

function cleanupSession() {
  if (session) {
    try {
      session.destroy()
    } catch {
      // ignore
    }
  }
  session = null
  rxBuffer = ''
  state.clockSynced = false
  state.connected = false
}

/**
 * @param {string} command
 * @param {{ timeoutMs?: number, allowEmpty?: boolean }} [opts]
 * allowEmpty: Incrementa (&I6F) não devolve frame — só avança o ponteiro.
 */
async function writeRead(command, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? IO_TIMEOUT_MS
  const allowEmpty = opts.allowEmpty === true
  const socket = await ensureSession(state.host, state.port)
  state.connected = true

  rxBuffer = ''

  await new Promise((resolve, reject) => {
    socket.write(command, 'ascii', (err) => (err ? reject(err) : resolve()))
  })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { frame, rest } = extractFrame(rxBuffer)
    if (frame) {
      rxBuffer = rest
      state.lastRaw = frame
      return frame
    }
    await delay(10)
  }

  if (allowEmpty) {
    state.lastRaw = null
    return ''
  }

  throw new Error(`Sem resposta para ${command} (${timeoutMs}ms)`)
}

/**
 * Incrementa ponteiro de leitura no CBC (DLL Incrementa → (&I6F), sem resposta).
 */
async function incrementa() {
  await writeRead(addChecksum('&I'), { timeoutMs: 250, allowEmpty: true })
  await delay(40)
}

/**
 * @param {string} host
 * @param {number} port
 */
async function syncClock(host, port) {
  state.host = host
  state.port = port
  const cmd = clockCommand()
  let last = ''
  for (let i = 0; i < 5; i += 1) {
    last = await writeRead(cmd, { timeoutMs: 2000 })
    if (last === '(&H)' || last.startsWith('(&H') || last === '(0)') {
      state.clockSynced = true
      return true
    }
  }
  state.clockSynced = false
  return false
}

/**
 * Parseia (&S...) — um caractere por LADO/ordem até firmware (DT435).
 * L=Livre P=Pronta F=Falha C=Concluiu A=Abastecendo B=Bloqueada E=Espera
 * A ordem (índice) NÃO é o código de bico do CBC.
 * @param {string | null} frame
 */
function parseNozzleStatuses(frame) {
  /** @type {Array<{ nozzle: number, bicoCode: string, code: string, status: 'livre' | 'pronta' | 'falha' | 'concluiu' | 'abastecendo' | 'bloqueada' | 'solicita' | 'desconhecido' }>} */
  const list = []
  if (!frame || frame.length < 3 || frame[1] !== 'S') return list

  const map = {
    L: 'livre',
    P: 'pronta',
    F: 'falha',
    C: 'concluiu',
    A: 'abastecendo',
    B: 'bloqueada',
    E: 'solicita',
    S: 'solicita',
    T: 'abastecendo', // alguns firmwares
  }

  const body = frame.slice(2, -1)
  let i = 0
  while (i < body.length && i < 48) {
    const ch = body[i]
    const code = ch.toUpperCase()
    // Para no início do trecho de firmware (ex.: DD6V3.7M1.0G…)
    if (!Object.prototype.hasOwnProperty.call(map, code)) break
    list.push({
      nozzle: i + 1,
      /** fallback: ordem do status — substituído por &V quando abastecendo */
      bicoCode: String(i + 1).padStart(2, '0'),
      code,
      status: map[code],
    })
    i += 1
  }
  return list
}

/**
 * Visualização (&V) — DT435: para cada bico abastecendo retorna (BBTTTTTT)
 * BB = código de bico (hex), TTTTTT = valor/volume. Sem abastecimento: (0)
 * @param {string | null} raw
 */
function parseVisualizacao(raw) {
  /** @type {Array<{ bicoCode: string, valueRaw: string, nozzle: number }>} */
  const list = []
  if (!raw) return list

  const frames = raw.match(/\([^)]*\)/g) ?? []
  for (const frame of frames) {
    const inner = frame.slice(1, -1)
    if (!inner || inner === '0') continue

    // Pode vir um ou vários blocos BBTTTTTT concatenados
    let pos = 0
    while (pos + 8 <= inner.length) {
      const chunk = inner.slice(pos, pos + 8)
      if (!/^[0-9A-Fa-f]{8}$/.test(chunk)) break
      const bicoCode = chunk.slice(0, 2).toUpperCase()
      const valueRaw = chunk.slice(2, 8)
      const nozzle = Number.parseInt(bicoCode, 16)
      if (!Number.isFinite(nozzle) || nozzle <= 0) {
        pos += 8
        continue
      }
      list.push({ bicoCode, valueRaw, nozzle })
      pos += 8
    }
  }
  return list
}

/**
 * Status dos bicos via (&S).
 */
async function readNozzleStatuses() {
  try {
    const raw = await writeRead(addChecksum('&S'), { timeoutMs: 1000 })
    return { statusRaw: raw, nozzles: parseNozzleStatuses(raw) }
  } catch {
    return { statusRaw: null, nozzles: [] }
  }
}

/**
 * Códigos de bico em abastecimento via (&V) — não usa a ordem do (&S).
 */
async function readVisualizacao() {
  try {
    // Protocolo aceita (&V) ou (&V7C); usamos checksum como nos demais comandos
    const raw = await writeRead(addChecksum('&V'), { timeoutMs: 1000 })
    return { visualRaw: raw, fueling: parseVisualizacao(raw) }
  } catch {
    return { visualRaw: null, fueling: [] }
  }
}

/**
 * Troca a ordem do (&S) pelos códigos de bico reais do (&V) nos que estão abastecendo.
 * @param {ReturnType<typeof parseNozzleStatuses>} nozzles
 * @param {ReturnType<typeof parseVisualizacao>} fueling
 */
function applyBicoCodesFromVisualizacao(nozzles, fueling) {
  if (fueling.length === 0) return nozzles
  const idle = nozzles.filter((n) => n.status !== 'abastecendo')
  const active = fueling.map((f) => ({
    nozzle: f.nozzle,
    bicoCode: f.bicoCode,
    code: 'A',
    status: /** @type {'abastecendo'} */ ('abastecendo'),
  }))
  return [...idle, ...active]
}

/**
 * Lê fila do CBC: (&A) → cache local → (&I) → próximo, até vazio.
 * Quando não há pendente, o CBC pode não responder — isso é fim de fila, não queda.
 * @param {number} [max]
 */
async function drainSupplies(max = 12) {
  for (let i = 0; i < max; i += 1) {
    let raw = ''
    try {
      raw = await writeRead(addChecksum('&A'), { timeoutMs: 1200 })
    } catch {
      // Sem frame = fila vazia (comportamento visto neste CBC)
      break
    }

    const parsed = parseSupplyFrame(raw)
    if (!parsed) break

    if (!pendingSupplies.has(parsed.supplyId)) {
      pendingSupplies.set(parsed.supplyId, parsed)
      console.log(
        `[CBC] Abast #${parsed.supplyId} bico ${parsed.nozzle} ${parsed.liters}L R$${parsed.total}`,
      )
    }

    // Sem Incrementa o CBC devolve sempre o mesmo registro
    await incrementa()
  }

  return [...pendingSupplies.values()]
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {unknown} data
 * @param {number} [status]
 */
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
 * @param {import('node:http').IncomingMessage} req
 */
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      sendJson(res, {
        ok: true,
        bridge: 'companytec-cbc',
        target: `${state.host}:${state.port}`,
        connected: state.connected && !!session && !session.destroyed,
        clockSynced: state.clockSynced,
        pending: pendingSupplies.size,
        lastError: state.lastError,
        lastCheck: state.lastCheck,
        lastRaw: state.lastRaw,
      })
      return
    }

    // Proxy CNPJ (mesmo molde AppSiTef → publica.cnpj.ws) — evita CORS no browser
    const cnpjMatch = url.pathname.match(/^\/api\/cnpj\/(\d{14})$/)
    if (req.method === 'GET' && cnpjMatch) {
      const digits = cnpjMatch[1]
      try {
        const upstream = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
          headers: { Accept: 'application/json' },
        })
        const text = await upstream.text()
        if (upstream.status === 404) {
          sendJson(res, { error: 'CNPJ não encontrado.' }, 404)
          return
        }
        if (upstream.status === 429) {
          sendJson(
            res,
            { error: 'Limite de consultas atingido. Aguarde e tente novamente.' },
            429,
          )
          return
        }
        if (!upstream.ok) {
          sendJson(res, { error: `Erro ao consultar CNPJ (HTTP ${upstream.status}).` }, 502)
          return
        }
        const data = text ? JSON.parse(text) : {}
        sendJson(res, data)
      } catch (err) {
        sendJson(
          res,
          { error: err instanceof Error ? err.message : 'Falha na consulta CNPJ' },
          502,
        )
      }
      return
    }

    if (req.method === 'GET' && url.pathname === '/cbc/poll') {
      const host = url.searchParams.get('host') || state.host
      const port = Number(url.searchParams.get('port') || state.port || DEFAULT_PORT)
      state.host = host
      state.port = port
      state.lastCheck = new Date().toISOString()

      try {
        const { supplies, nozzles, statusRaw, visualRaw } = await withLock(async () => {
          await ensureSession(host, port)
          if (!state.clockSynced) {
            await syncClock(host, port)
          }
          const supplies = await drainSupplies(12)
          const status = await readNozzleStatuses()
          const visual = await readVisualizacao()
          const nozzles = applyBicoCodesFromVisualizacao(status.nozzles, visual.fueling)
          return {
            supplies,
            nozzles,
            statusRaw: status.statusRaw,
            visualRaw: visual.visualRaw,
          }
        })

        state.connected = true
        state.lastError = null

        sendJson(res, {
          ok: true,
          connected: true,
          clockSynced: state.clockSynced,
          host,
          port,
          supplies,
          nozzles,
          statusRaw,
          visualRaw,
          pending: pendingSupplies.size,
          lastRaw: state.lastRaw,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        state.lastError = message
        state.connected = false
        if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|Timeout ao conectar|Timeout/i.test(message)) {
          cleanupSession()
        }
        const cached = [...pendingSupplies.values()]
        // Sempre sinaliza offline no concentrador — cache não mascara a falha
        sendJson(
          res,
          {
            ok: false,
            connected: false,
            host,
            port,
            error: message,
            supplies: cached,
            nozzles: [],
            pending: pendingSupplies.size,
          },
          503,
        )
      }
      return
    }

    if (req.method === 'POST' && url.pathname === '/cbc/command') {
      const body = await readBody(req)
      const host = body.host || state.host
      const port = Number(body.port || state.port || DEFAULT_PORT)
      state.host = host
      state.port = port

      const result = await withLock(async () => {
        if (body.command === 'ACK_SUPPLY') {
          const id = String(body.supplyId ?? '')
          pendingSupplies.delete(id)
          // CBC já foi incrementado na leitura; ACK só limpa cache local do PDV
          return { ok: true, command: 'ACK_SUPPLY', supplyId: id, response: '' }
        }

        await ensureSession(host, port)

        let command = typeof body.raw === 'string' ? body.raw : null
        if (!command && typeof body.command === 'string') {
          command = body.command.startsWith('(')
            ? body.command
            : body.command.startsWith('&')
              ? addChecksum(body.command)
              : addChecksum(`&${body.command}`)
        }
        if (!command) {
          return { ok: false, error: 'Informe command ou raw' }
        }

        const allowEmpty = command.startsWith('(&I')
        const response = await writeRead(command, {
          timeoutMs: Number(body.timeoutMs) || IO_TIMEOUT_MS,
          allowEmpty,
        })
        return { ok: true, command, response, supplyId: body.supplyId ?? null }
      })

      sendJson(res, { host, port, ...result }, result.ok ? 200 : 400)
      return
    }

    sendJson(res, { error: 'Rota não encontrada' }, 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    state.lastError = message
    sendJson(res, { error: message }, 500)
  }
})

export { addChecksum, parseSupplyFrame, clockCommand, applyVirgula }

const isMain =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  server.listen(BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`[CBC Bridge] http://127.0.0.1:${BRIDGE_PORT}`)
    console.log(`[CBC Bridge] Alvo: ${DEFAULT_HOST}:${DEFAULT_PORT}`)
    console.log(`[CBC Bridge] Protocolo: (&H) · (&A67) · Incrementa (&I6F)`)
  })
}
