/**
 * Binding CliSiTef64I.dll (Win64) via koffi.
 * Alinhado ao exemplo oficial Delphi/C# (SDK CliSiTef Windows).
 *
 * Fluxo:
 *   ConfiguraIntSiTefInterativo[Ex]
 *   → IniciaFuncaoSiTefInterativo
 *   → loop ContinuaFuncaoSiTefInterativo (sts=10000)  [padrão Delphi ProcessoIterativo]
 *   → sts=0: aprovada (pendente Finaliza)
 *   → FinalizaFuncaoSiTefInterativo(confirma, cupom, data, hora, paramAdic)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const CLISITEF_DIR = path.resolve(__dirname, 'clisitef64')
const DLL_NAME = 'CliSiTef64I.dll'
const DLL_PATH = path.join(CLISITEF_DIR, DLL_NAME)

/**
 * Comandos ContinuaFuncaoSiTefInterativo — CliSiTef.pas (exemplo oficial).
 * NÃO confundir com mapeamentos antigos (21≠campo, 22≠menu, 23≠tecla).
 */
const CMD = {
  RESULT_DATA: 0,
  SHOW_MSG_CASHIER: 1,
  SHOW_MSG_CUSTOMER: 2,
  SHOW_MSG_CASHIER_CUSTOMER: 3,
  SHOW_MENU_TITLE: 4,
  CLEAR_MSG_CASHIER: 11,
  CLEAR_MSG_CUSTOMER: 12,
  CLEAR_MSG_CASHIER_CUSTOMER: 13,
  CLEAR_MENU_TITLE: 14,
  SHOW_HEADER: 15,
  CLEAR_HEADER: 16,
  CONFIRM_GO_BACK: 19,
  CONFIRMATION: 20,
  GET_MENU_OPTION: 21,
  PRESS_ANY_KEY: 22,
  /** Polling: app deve continuar (0) ou abortar (-1). */
  ABORT_REQUEST: 23,
  GET_FIELD_INTERNAL: 29,
  GET_FIELD: 30,
  GET_FIELD_CHECK: 31,
  GET_FIELD_TRACK: 32,
  GET_FIELD_PASSWORD: 33,
  GET_FIELD_CURRENCY: 34,
  GET_FIELD_BARCODE: 35,
  GET_PINPAD_CONFIRMATION: 37,
  GET_MASKED_FIELD: 41,
  /** Carteiras digitais / PIX (versões recentes). */
  SHOW_QRCODE: 50,
  CLEAR_QRCODE: 51,
}

/** Tipos de campo em CMD.RESULT_DATA (documentação + exemplo C#). */
const CAMPO = {
  FINALIZACAO: 1,
  COMPROVANTE_CLIENTE: 121,
  COMPROVANTE_LOJA: 122,
  REDE_DESTINO: 131,
  TIPO_CARTAO: 132,
  NSU_SITEF: 133,
  COD_AUTORIZACAO: 134,
  BANDEIRA: 156,
}

let lib = null
let api = null
let configured = false
let busy = false
/** @type {Map<string, { cupom: string, date: string, time: string, finalized: boolean }>} */
const pendingFinalize = new Map()

function pad2(n) {
  return String(n).padStart(2, '0')
}

function fiscalNow() {
  const d = new Date()
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  return { date, time }
}

function formatValorSiTef(amount) {
  return Number(amount).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Cupom só dígitos e crescente (exigência CliSiTef: CupomFiscal + DataFiscal). */
let cupomSeq = Number(String(Date.now()).slice(-8))

function nextCupomFiscal(preferred) {
  const digits = String(preferred || '').replace(/\D/g, '')
  if (digits && Number(digits) > cupomSeq) {
    cupomSeq = Number(digits)
    return digits.slice(-20)
  }
  cupomSeq += 1
  return String(cupomSeq)
}

function describeSts(sts) {
  const map = {
    0: 'OK / aprovada',
    [-1]: 'módulo não inicializado / cancelada',
    [-2]: 'cancelada pelo operador',
    [-3]: 'função inválida',
    [-5]: 'sem comunicação com o SiTef',
    [-6]: 'cancelada no pinpad',
    [-9]: 'Continua sem Inicia',
    [-10]: 'parâmetro obrigatório ausente',
    [-12]: 'processo iterativo anterior incompleto',
    [-15]: 'cancelada pela automação',
    [-20]: 'parâmetro inválido',
    [-40]: 'negada pelo SiTef',
    [-43]: 'problema no pinpad',
    [-100]: 'erro interno do módulo (coleta/buffer/estado)',
  }
  return map[sts] || `código ${sts}`
}

function bufferToText(buffer) {
  return buffer.toString('latin1').replace(/\0+$/g, '').replace(/\0/g, '').trim()
}

function writeBufferText(buffer, text) {
  buffer.fill(0)
  if (!text) return
  Buffer.from(String(text), 'latin1').copy(
    buffer,
    0,
    0,
    Math.min(String(text).length, buffer.length - 1),
  )
}

function isDisplayCommand(comando) {
  return (
    comando === CMD.SHOW_MSG_CASHIER ||
    comando === CMD.SHOW_MSG_CUSTOMER ||
    comando === CMD.SHOW_MSG_CASHIER_CUSTOMER ||
    comando === CMD.SHOW_MENU_TITLE ||
    comando === CMD.SHOW_HEADER ||
    comando === CMD.CLEAR_MSG_CASHIER ||
    comando === CMD.CLEAR_MSG_CUSTOMER ||
    comando === CMD.CLEAR_MSG_CASHIER_CUSTOMER ||
    comando === CMD.CLEAR_MENU_TITLE ||
    comando === CMD.CLEAR_HEADER ||
    comando === CMD.SHOW_QRCODE ||
    comando === CMD.CLEAR_QRCODE
  )
}

function ensureLoaded() {
  if (api) return api

  if (!fs.existsSync(DLL_PATH)) {
    throw new Error(
      `CliSiTef64I.dll não encontrada em ${CLISITEF_DIR}. Copie as DLLs Win64 do SDK CliSiTef.`,
    )
  }

  // A DLL procura CliSiTef.ini e dependências no diretório de trabalho.
  process.chdir(CLISITEF_DIR)

  const koffi = require('koffi')
  lib = koffi.load(DLL_PATH)

  // Assinaturas alinhadas ao Delphi (TamMaxBuffer = Integer; Finaliza com pParamAdic).
  let ConfiguraIntSiTefInterativoEx = null
  try {
    ConfiguraIntSiTefInterativoEx = lib.func(
      'int __stdcall ConfiguraIntSiTefInterativoEx(str ip, str loja, str terminal, int16_t reservado, str paramAdic)',
    )
  } catch {
    ConfiguraIntSiTefInterativoEx = null
  }

  const ConfiguraIntSiTefInterativo = lib.func(
    'int __stdcall ConfiguraIntSiTefInterativo(str ip, str loja, str terminal, int16_t reservado)',
  )
  const IniciaFuncaoSiTefInterativo = lib.func(
    'int __stdcall IniciaFuncaoSiTefInterativo(int funcao, str valor, str cupom, str dataFiscal, str horaFiscal, str operador, str paramAdic)',
  )
  const ContinuaFuncaoSiTefInterativo = lib.func(
    'int __stdcall ContinuaFuncaoSiTefInterativo(_Out_ int *comando, _Out_ int *tipoCampo, _Out_ int16_t *tamMinimo, _Out_ int16_t *tamMaximo, _Inout_ uint8 *buffer, int tamBuffer, int continua)',
  )
  // Delphi: procedure FinalizaFuncaoSiTefInterativo(...); stdcall;
  const FinalizaFuncaoSiTefInterativo = lib.func(
    'void __stdcall FinalizaFuncaoSiTefInterativo(int16_t confirma, str cupom, str dataFiscal, str horaFiscal, str paramAdic)',
  )

  let DescarregaMensagens = null
  try {
    DescarregaMensagens = lib.func('int __stdcall DescarregaMensagens()')
  } catch {
    DescarregaMensagens = null
  }

  api = {
    ConfiguraIntSiTefInterativoEx,
    ConfiguraIntSiTefInterativo,
    IniciaFuncaoSiTefInterativo,
    ContinuaFuncaoSiTefInterativo,
    FinalizaFuncaoSiTefInterativo,
    DescarregaMensagens,
    BufferSize: 20000,
  }

  console.log(`[CliSiTef] DLL carregada: ${DLL_PATH}`)
  return api
}

function normalizeTerminalId(raw) {
  const s = String(raw || 'PD000002').trim().toUpperCase()
  const match = s.match(/^([A-Z]+)(\d+)$/)
  if (match) {
    const letters = match[1].slice(0, 2).padEnd(2, 'X')
    const digits = match[2].padStart(6, '0').slice(-6)
    return `${letters}${digits}`
  }
  return s.padEnd(8, ' ').slice(0, 8)
}

function normalizeStoreId(raw) {
  return String(raw || '00000000').replace(/\D/g, '').padStart(8, '0').slice(0, 8)
}

/**
 * @param {{ sitefIp: string, storeId: string, terminalId: string, paramAdic?: string }} cfg
 */
export function configureCliSiTef(cfg) {
  const a = ensureLoaded()
  const ip = cfg.sitefIp || '192.168.1.7'
  const loja = normalizeStoreId(cfg.storeId)
  const terminal = normalizeTerminalId(cfg.terminalId || 'PDV0002')
  const paramAdic = cfg.paramAdic || ''

  let rc
  if (a.ConfiguraIntSiTefInterativoEx) {
    rc = a.ConfiguraIntSiTefInterativoEx(ip, loja, terminal, 0, paramAdic)
  } else {
    rc = a.ConfiguraIntSiTefInterativo(ip, loja, terminal, 0)
  }

  configured = rc === 0
  if (!configured) {
    const hints = {
      1: 'IP inválido',
      2: 'loja inválida',
      3: 'terminal inválido (use XXnnnnnn, 2 letras + 6 dígitos)',
      10: 'sem permissão de escrita na pasta CliSiTef',
      12: 'modo seguro / arquivo .cha',
    }
    const hint = hints[rc] ? ` — ${hints[rc]}` : ''
    throw new Error(`ConfiguraIntSiTefInterativo retornou ${rc}${hint}`)
  }
  console.log(
    `[CliSiTef] Configurado IP=${ip} loja=${loja} terminal=${terminal}` +
      (a.ConfiguraIntSiTefInterativoEx ? ' (Ex)' : ''),
  )
  return rc
}

export function isCliSiTefReady() {
  return fs.existsSync(DLL_PATH)
}

export function isCliSiTefConfigured() {
  return configured
}

export function isCliSiTefBusy() {
  return busy
}

/**
 * @param {any} tx
 * @param {number} comando
 * @param {string} text
 */
function applyMessage(tx, comando, text) {
  const msg = (text || '').trim()
  if (
    comando === CMD.SHOW_MSG_CASHIER ||
    comando === CMD.SHOW_MSG_CUSTOMER ||
    comando === CMD.SHOW_MSG_CASHIER_CUSTOMER ||
    comando === CMD.SHOW_MENU_TITLE ||
    comando === CMD.SHOW_HEADER
  ) {
    if (!msg) return
    tx.message = msg
    const lower = msg.toLowerCase()
    if (lower.includes('cart') || lower.includes('aproxime') || lower.includes('insira')) {
      tx.status = 'waiting_card'
    } else if (lower.includes('senha') || lower.includes('pin')) {
      tx.status = 'waiting_pin'
    } else if (lower.includes('pix') || lower.includes('qr')) {
      tx.status = 'waiting_pix'
    } else if (lower.includes('autoriz') || lower.includes('process')) {
      tx.status = 'processing'
    }
  }

  if (comando === CMD.SHOW_QRCODE) {
    tx.status = 'waiting_pix'
    tx.message = 'Exiba o QR Code para o cliente'
    if (msg) tx.pixQrPayload = msg
  }
  if (comando === CMD.CLEAR_QRCODE) {
    tx.pixQrPayload = null
  }
}

function parseMenuOptions(buffer) {
  return String(buffer || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const idx = item.indexOf(':')
      if (idx < 0) return { code: item, label: item }
      return {
        code: item.slice(0, idx).trim(),
        label: item.slice(idx + 1).trim(),
      }
    })
    .filter((o) => o.code)
    // Cheque (função 1) — não oferecer no PDV mesmo se a CliSiTef listar.
    .filter((o) => {
      const label = o.label.toLowerCase()
      const code = o.code.trim()
      if (code === '1' && label.includes('cheque')) return false
      if (label === 'cheque' || label.startsWith('cheque')) return false
      return true
    })
}

/**
 * Aguarda escolha do operador no PDV (menu / campo / confirmação / tecla / voltar).
 * @param {any} tx
 * @param {'menu' | 'field' | 'confirm' | 'key'} kind
 * @param {{ allowEmpty?: boolean }} [opts]
 * @returns {Promise<{ cancelled: boolean, goBack?: boolean, value: string }>}
 */
async function waitOperatorInput(tx, kind, opts = {}) {
  const allowEmpty = Boolean(opts.allowEmpty)
  tx.inputKind = kind
  tx.inputValue = null
  tx.goBack = false
  const started = Date.now()
  while (!tx.cancelled && !tx.goBack) {
    if (tx.inputValue != null) {
      if (allowEmpty || String(tx.inputValue) !== '') break
      tx.inputValue = null
    }
    if (Date.now() - started > 5 * 60 * 1000) {
      return { cancelled: true, value: '' }
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  if (tx.cancelled) return { cancelled: true, value: '' }
  if (tx.goBack) {
    tx.goBack = false
    tx.inputValue = null
    tx.inputKind = null
    return { cancelled: false, goBack: true, value: '' }
  }
  const value = String(tx.inputValue ?? '')
  tx.inputValue = null
  tx.inputKind = null
  return { cancelled: false, value }
}

/**
 * Entrega resposta do operador para a transação em andamento.
 * @param {any} tx
 * @param {string} value
 */
export function submitCliSiTefInput(tx, value) {
  if (!tx) return { ok: false, error: 'Transação não encontrada' }
  const waiting =
    tx.status === 'waiting_menu' ||
    tx.status === 'waiting_field' ||
    tx.status === 'waiting_confirm' ||
    tx.status === 'waiting_key'
  if (!waiting) {
    return { ok: false, error: 'Transação não está aguardando entrada do operador' }
  }
  tx.goBack = false
  tx.inputValue = String(value ?? '')
  tx.updatedAt = new Date().toISOString()
  return { ok: true }
}

/**
 * Volta à etapa anterior da coleta (ContinuaFuncao = 1).
 * @param {any} tx
 */
export function requestCliSiTefGoBack(tx) {
  if (!tx) return { ok: false, error: 'Transação não encontrada' }
  const waiting =
    tx.status === 'waiting_menu' ||
    tx.status === 'waiting_field' ||
    tx.status === 'waiting_confirm' ||
    tx.status === 'waiting_key'
  if (!waiting) {
    return { ok: false, error: 'Só é possível voltar durante uma coleta no PDV.' }
  }
  tx.goBack = true
  tx.menuOptions = null
  tx.fieldPrompt = null
  tx.message = 'Voltando à etapa anterior…'
  tx.updatedAt = new Date().toISOString()
  return { ok: true }
}

function fieldPromptFor(comando, tipoCampo, bufferText, tamMin, tamMax) {
  const known = {
    505: 'Número de parcelas',
    532: 'Quantidade de parcelas / cheques',
    506: 'Data do pré-datado (DDMMAAAA)',
    507: 'Primeira parcela à vista? (0 = sim, 1 = não)',
    508: 'Intervalo em dias entre parcelas',
    510: 'Pré-datado com garantia? (0 = com, 1 = sem)',
    524: 'Valor da primeira parcela',
    525: 'Valor das demais parcelas',
    140: 'Data da primeira parcela (DDMMAAAA)',
  }
  const prompt =
    (bufferText && bufferText.trim()) ||
    known[tipoCampo] ||
    (comando === CMD.GET_FIELD_CURRENCY
      ? 'Informe o valor'
      : `Informe o dado solicitado (campo ${tipoCampo})`)

  let inputMode = 'text'
  if (comando === CMD.GET_FIELD_CURRENCY || [524, 525, 138, 145, 146, 147].includes(tipoCampo)) {
    inputMode = 'currency'
  } else if (
    [505, 532, 507, 508, 510].includes(tipoCampo) ||
    (tamMin > 0 && tamMax <= 4 && tipoCampo > 0)
  ) {
    inputMode = 'number'
  }

  return {
    prompt,
    minLength: Number(tamMin) || 0,
    maxLength: Number(tamMax) || 40,
    inputMode,
    tipoCampo: Number(tipoCampo) || 0,
  }
}

/**
 * Resposta automática — só para pinpad / abort / display.
 * Coletas de operador (parcelas, confirmação, campos) vão para a UI.
 */
function autoReply(comando, bufferIn, ctx = {}) {
  void bufferIn
  switch (comando) {
    case CMD.ABORT_REQUEST:
      return { output: '', continua: 0, delayMs: 250, keepBuffer: true }

    case CMD.GET_FIELD_PASSWORD:
    case CMD.GET_FIELD_TRACK:
    case CMD.GET_FIELD_INTERNAL:
      return { output: '', continua: 0, keepBuffer: true }

    case CMD.GET_PINPAD_CONFIRMATION:
      // Confirmação no próprio pinpad — só continuar.
      return { output: '0', continua: 0 }

    default:
      if (isDisplayCommand(comando)) {
        return { output: '', continua: 0 }
      }
      return { output: '', continua: 0 }
  }
}

function applyResultField(tx, campo, text) {
  const value = (text || '').trim()
  if (!value && campo !== CAMPO.COMPROVANTE_CLIENTE && campo !== CAMPO.COMPROVANTE_LOJA) return

  switch (campo) {
    case CAMPO.COMPROVANTE_CLIENTE:
      tx.receiptCustomer = `${tx.receiptCustomer || ''}${text}\n`
      break
    case CAMPO.COMPROVANTE_LOJA:
      tx.receiptMerchant = `${tx.receiptMerchant || ''}${text}\n`
      break
    case CAMPO.NSU_SITEF:
      tx.nsu = value
      break
    case CAMPO.COD_AUTORIZACAO:
      tx.authorizationCode = value
      break
    case CAMPO.BANDEIRA:
    case CAMPO.TIPO_CARTAO:
      tx.brand = value
      break
    case CAMPO.REDE_DESTINO:
      tx.message = value ? `Rede: ${value}` : tx.message
      break
    case CAMPO.FINALIZACAO:
      if (value) tx.message = value
      break
    default:
      break
  }
}

/**
 * Confirma (1) ou desfaz (0) na CliSiTef — equivalente a FinishTransaction do Delphi.
 * @param {string} transactionId
 * @param {0|1} confirma
 */
export function finalizeCliSiTefTransaction(transactionId, confirma) {
  const pending = pendingFinalize.get(transactionId)
  if (!pending) {
    return { ok: false, error: 'Nenhuma transação pendente de Finaliza para este id.' }
  }
  if (pending.finalized) {
    return { ok: true, already: true }
  }

  const a = ensureLoaded()
  try {
    a.FinalizaFuncaoSiTefInterativo(confirma, pending.cupom, pending.date, pending.time, '')
    pending.finalized = true
    pendingFinalize.delete(transactionId)
    console.log(`[CliSiTef] Finaliza confirma=${confirma} id=${transactionId}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Executa função interativa CliSiTef, atualizando `tx` (padrão ProcessoIterativo).
 * Em aprovação (sts=0) NÃO chama Finaliza — use finalizeCliSiTefTransaction no confirm/cancel.
 *
 * @param {any} tx
 * @param {{ sitefIp: string, storeId: string, terminalId: string }} cfg
 */
export async function runCliSiTefTransaction(tx, cfg) {
  if (busy) {
    tx.status = 'error'
    tx.error = 'Outra transação TEF já está em andamento'
    tx.message = tx.error
    return
  }

  busy = true
  let abortPolls = 0
  try {
    if (!configured) configureCliSiTef(cfg)

    const a = ensureLoaded()
    const { date, time } = fiscalNow()
    const valor = formatValorSiTef(tx.amount)
    const cupom = nextCupomFiscal(tx.cupom)
    const operador = String(tx.operator || 'CAIXA').slice(0, 20)
    tx.cupom = cupom

    tx.fiscalDate = date
    tx.fiscalTime = time
    tx.status = 'starting'
    tx.message = 'Iniciando CliSiTef…'
    tx.receiptCustomer = ''
    tx.receiptMerchant = ''

    // Limpa mensagens residuais de ciclo anterior (quando disponível).
    try {
      a.DescarregaMensagens?.()
    } catch {
      /* ignore */
    }

    console.log(
      `[CliSiTef] Inicia func=${tx.functionId} valor=${valor} cupom=${cupom} data=${date} hora=${time}`,
    )

    let sts = a.IniciaFuncaoSiTefInterativo(
      tx.functionId,
      valor,
      cupom,
      date,
      time,
      operador,
      '',
    )

    if (sts !== 10000 && sts !== 0) {
      tx.status = 'error'
      tx.error =
        sts === -43
          ? 'CliSiTef -43: problema no pinpad (USB/porta/ocupado).'
          : sts === -100
            ? 'CliSiTef -100: erro interno do módulo. Feche outras automações TEF, confirme/cancele pendências e tente de novo.'
            : `IniciaFuncaoSiTefInterativo=${sts} (${describeSts(sts)})`
      tx.message = tx.error
      return
    }

    const comando = [0]
    const tipoCampo = [0]
    const tamMin = [0]
    const tamMax = [0]
    const buffer = Buffer.alloc(a.BufferSize)
    /** ContinuaNavegacao do próximo Continua (Delphi). */
    let continuaNavegacao = 0

    while (sts === 10000) {
      if (tx.cancelled) {
        continuaNavegacao = -1
      }

      sts = a.ContinuaFuncaoSiTefInterativo(
        comando,
        tipoCampo,
        tamMin,
        tamMax,
        buffer,
        a.BufferSize,
        continuaNavegacao,
      )

      if (sts !== 10000) {
        console.log(`[CliSiTef] fim laço sts=${sts} (${describeSts(sts)})`)
        break
      }

      const cmd = comando[0]
      const campo = tipoCampo[0]
      const minLen = tamMin[0]
      const maxLen = tamMax[0]
      const text = bufferToText(buffer)

      console.log(
        `[CliSiTef] cmd=${cmd} campo=${campo} min=${minLen} max=${maxLen} buf="${text.slice(0, 80)}"`,
      )

      // Reset ContinuaNavegacao (só aborta se evento pedir -1).
      continuaNavegacao = 0

      if (cmd === CMD.RESULT_DATA) {
        // Doc: se Comando=0, próxima chamada deve manter o dado original no Buffer.
        applyResultField(tx, campo, text)
      } else if (cmd === CMD.SHOW_MENU_TITLE) {
        tx.menuTitle = text || 'Selecione'
        applyMessage(tx, cmd, text)
        writeBufferText(buffer, '')
      } else if (cmd === CMD.CLEAR_MENU_TITLE) {
        tx.menuTitle = null
        writeBufferText(buffer, '')
      } else if (cmd === CMD.GET_MENU_OPTION) {
        // NÃO auto-selecionar a 1ª opção (Cheque) — isso gerava "Dados Invalidos" / -100.
        const options = parseMenuOptions(text)
        if (options.length === 0) {
          console.warn('[CliSiTef] Menu sem opções válidas após filtro — cancelando')
          continuaNavegacao = -1
          writeBufferText(buffer, '')
        } else {
          tx.status = 'waiting_menu'
          tx.message = tx.menuTitle || 'Selecione a forma de pagamento'
          tx.menuOptions = options
          tx.updatedAt = new Date().toISOString()
          console.log(
            `[CliSiTef] Aguardando menu (${options.length} opções): ${options.map((o) => o.code + ':' + o.label).join(' | ')}`,
          )

          const choice = await waitOperatorInput(tx, 'menu')
          tx.menuOptions = null
          if (choice.cancelled) {
            continuaNavegacao = -1
            writeBufferText(buffer, '')
          } else if (choice.goBack) {
            console.log('[CliSiTef] Voltar (menu) → Continua=1')
            continuaNavegacao = 1
            writeBufferText(buffer, '')
            tx.status = 'processing'
            tx.message = 'Voltando à etapa anterior…'
          } else {
            console.log(`[CliSiTef] Menu escolhido: ${choice.value}`)
            writeBufferText(buffer, choice.value)
            tx.status = 'processing'
            tx.message = 'Continuando no pinpad…'
          }
        }
      } else if (cmd === CMD.CONFIRMATION || cmd === CMD.CONFIRM_GO_BACK) {
        tx.status = 'waiting_confirm'
        tx.message = text || 'Confirma?'
        tx.fieldPrompt = {
          prompt: text || 'Confirma a operação?',
          minLength: 1,
          maxLength: 1,
          inputMode: 'text',
          tipoCampo: campo,
        }
        tx.menuOptions = null
        tx.updatedAt = new Date().toISOString()
        const choice = await waitOperatorInput(tx, 'confirm')
        tx.fieldPrompt = null
        if (choice.cancelled) {
          continuaNavegacao = -1
          writeBufferText(buffer, '')
        } else if (choice.goBack) {
          console.log('[CliSiTef] Voltar (confirmação) → Continua=1')
          continuaNavegacao = 1
          writeBufferText(buffer, '')
          tx.status = 'processing'
          tx.message = 'Voltando à etapa anterior…'
        } else {
          // 0 = Sim, 1 = Não (documentação CliSiTef)
          writeBufferText(buffer, choice.value === '1' ? '1' : '0')
          tx.status = 'processing'
          tx.message = 'Continuando…'
        }
      } else if (
        cmd === CMD.GET_FIELD ||
        cmd === CMD.GET_FIELD_CHECK ||
        cmd === CMD.GET_FIELD_CURRENCY ||
        cmd === CMD.GET_FIELD_BARCODE ||
        cmd === CMD.GET_MASKED_FIELD
      ) {
        // Valor da venda já conhecido — devolve sem UI.
        if (
          cmd === CMD.GET_FIELD_CURRENCY &&
          [138, 145, 146, 147].includes(campo)
        ) {
          writeBufferText(buffer, formatValorSiTef(tx.amount))
        } else {
          const prompt = fieldPromptFor(cmd, campo, text, minLen, maxLen)
          tx.status = 'waiting_field'
          tx.message = prompt.prompt
          tx.fieldPrompt = prompt
          tx.menuOptions = null
          tx.updatedAt = new Date().toISOString()
          console.log(
            `[CliSiTef] Aguardando campo tipo=${campo} min=${minLen} max=${maxLen}: ${prompt.prompt}`,
          )

          const answer = await waitOperatorInput(tx, 'field')
          tx.fieldPrompt = null
          if (answer.cancelled) {
            continuaNavegacao = -1
            writeBufferText(buffer, '')
          } else if (answer.goBack) {
            console.log('[CliSiTef] Voltar (campo) → Continua=1')
            continuaNavegacao = 1
            writeBufferText(buffer, '')
            tx.status = 'processing'
            tx.message = 'Voltando à etapa anterior…'
          } else {
            let value = answer.value.trim()
            if (prompt.inputMode === 'currency') {
              // Aceita 10,50 ou 10.50 → formato BR com vírgula
              const n = Number(value.replace(/\./g, '').replace(',', '.'))
              value = Number.isFinite(n) ? formatValorSiTef(n) : value
            }
            if (prompt.maxLength > 0 && value.length > prompt.maxLength) {
              value = value.slice(0, prompt.maxLength)
            }
            console.log(`[CliSiTef] Campo ${campo} informado: ${value}`)
            writeBufferText(buffer, value)
            tx.status = 'processing'
            tx.message = 'Continuando no pinpad…'
          }
        }
      } else if (cmd === CMD.PRESS_ANY_KEY) {
        tx.status = 'waiting_key'
        tx.message = text || 'Pressione OK para continuar'
        tx.fieldPrompt = {
          prompt: text || 'Pressione OK para continuar',
          minLength: 0,
          maxLength: 0,
          inputMode: 'text',
          tipoCampo: -1,
        }
        tx.menuOptions = null
        tx.updatedAt = new Date().toISOString()
        const ack = await waitOperatorInput(tx, 'key', { allowEmpty: true })
        tx.fieldPrompt = null
        if (tx.cancelled || ack.cancelled) {
          continuaNavegacao = -1
        } else if (ack.goBack) {
          console.log('[CliSiTef] Voltar (tecla) → Continua=1')
          continuaNavegacao = 1
          tx.status = 'processing'
          tx.message = 'Voltando à etapa anterior…'
        } else {
          tx.status = 'processing'
        }
        writeBufferText(buffer, '')
      } else {
        applyMessage(tx, cmd, text)
        const reply = autoReply(cmd, text, {
          tamMin: minLen,
          tamMax: maxLen,
          tipoCampo: campo,
          amount: tx.amount,
        })
        continuaNavegacao = reply.continua

        if (cmd === CMD.ABORT_REQUEST) {
          abortPolls += 1
          if (abortPolls > 150) {
            continuaNavegacao = -1
          } else if (reply.delayMs) {
            await new Promise((r) => setTimeout(r, reply.delayMs))
          }
        } else {
          abortPolls = 0
        }

        if (!reply.keepBuffer) {
          writeBufferText(buffer, reply.output)
        }
      }

      tx.updatedAt = new Date().toISOString()
      await new Promise((r) => setImmediate(r))
    }

    if (tx.cancelled || continuaNavegacao === -1) {
      tx.status = 'cancelled'
      tx.message = 'Transação cancelada'
      return
    }

    if (sts === 0) {
      pendingFinalize.set(tx.transactionId, {
        cupom,
        date,
        time,
        finalized: false,
      })
      tx.status = 'approved'
      tx.message = 'Transação aprovada — aguardando confirmação'
      tx.receiptCustomer = (tx.receiptCustomer || '').trim() || null
      tx.receiptMerchant = (tx.receiptMerchant || '').trim() || null
    } else if (sts === -2 || sts === -1 || sts === -6 || sts === -15) {
      tx.status = 'cancelled'
      tx.message = `Cancelada (${describeSts(sts)})`
    } else if (sts === -43) {
      tx.status = 'error'
      tx.error =
        'CliSiTef -43: problema no pinpad (desconectado, porta errada ou ocupado). Verifique USB/AUTO_USB e tente de novo.'
      tx.message = tx.error
    } else if (sts === -100) {
      tx.status = 'error'
      tx.error =
        'CliSiTef -100: erro interno do módulo. Em geral: coleta inválida, cupom repetido ou transação anterior sem Finaliza. Feche outros TEF, reinicie a ponte e tente novamente.'
      tx.message = tx.error
    } else if (sts === -12) {
      tx.status = 'error'
      tx.error =
        'CliSiTef -12: processo iterativo anterior incompleto. Reinicie a ponte TEF e tente de novo.'
      tx.message = tx.error
    } else {
      tx.status = 'denied'
      tx.message = `Negada / erro CliSiTef (${describeSts(sts)})`
      tx.error = `ContinuaFuncaoSiTefInterativo=${sts}`
    }
  } catch (err) {
    tx.status = 'error'
    tx.error = err instanceof Error ? err.message : String(err)
    tx.message = tx.error
    console.error('[CliSiTef]', err)
  } finally {
    busy = false
    tx.updatedAt = new Date().toISOString()
  }
}

export const CLISITEF_PATHS = {
  dir: CLISITEF_DIR,
  dll: DLL_PATH,
}

export const CLISITEF_CMD = CMD
export const CLISITEF_CAMPO = CAMPO
