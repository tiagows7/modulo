/**
 * Impressão RAW no Windows (winspool) via koffi — sem diálogo do sistema.
 * Equivalente ao envio direto do ACBr para a fila da impressora.
 */
import { execFileSync } from 'node:child_process'
import koffi from 'koffi'

const winspool = koffi.load('winspool.drv')
const kernel32 = koffi.load('kernel32.dll')

const DOC_INFO_1W = koffi.struct('DOC_INFO_1W', {
  pDocName: 'str16',
  pOutputFile: 'str16',
  pDatatype: 'str16',
})

const OpenPrinterW = winspool.func(
  'bool __stdcall OpenPrinterW(str16 pPrinterName, _Out_ void **phPrinter, void *pDefault)',
)
const ClosePrinter = winspool.func('bool __stdcall ClosePrinter(void *hPrinter)')
const StartDocPrinterW = winspool.func(
  'uint __stdcall StartDocPrinterW(void *hPrinter, uint Level, DOC_INFO_1W *pDocInfo)',
)
const EndDocPrinter = winspool.func('bool __stdcall EndDocPrinter(void *hPrinter)')
const StartPagePrinter = winspool.func('bool __stdcall StartPagePrinter(void *hPrinter)')
const EndPagePrinter = winspool.func('bool __stdcall EndPagePrinter(void *hPrinter)')
const WritePrinter = winspool.func(
  'bool __stdcall WritePrinter(void *hPrinter, void *pBuf, uint cbBuf, _Out_ uint *pcWritten)',
)
const GetLastError = kernel32.func('uint __stdcall GetLastError()')

function lastErrorMessage() {
  const code = GetLastError()
  if (!code) return ''
  const hints = {
    1801: 'impressora inválida',
    1802: 'impressora desconhecida',
    1804: 'datatype inválido (tente driver Generic/Text Only)',
    1905: 'impressora excluída ou com falha (PendingDeletion) — use outra fila',
    1722: 'RPC indisponível',
  }
  const hint = hints[code] ? ` — ${hints[code]}` : ''
  return ` (Win32 ${code}${hint})`
}

/**
 * @returns {string[]}
 */
export function listPrinterNames() {
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-Printer | Select-Object -ExpandProperty Name',
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * @returns {string | null}
 */
export function getDefaultPrinterName() {
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '(Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name',
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim()
    return out || null
  } catch {
    return null
  }
}

/**
 * @param {string} [preferred]
 * @returns {string}
 */
export function resolvePrinterName(preferred) {
  const name = String(preferred || '').trim()
  if (name) return name

  const def = getDefaultPrinterName()
  if (def) return def

  const list = listPrinterNames()
  const elgin = list.find((p) => /elgin/i.test(p))
  if (elgin) return elgin

  throw new Error(
    'Nenhuma impressora configurada. Defina FISCAL_PRINTER_NAME (ex.: "ELGIN i8").',
  )
}

/**
 * Envia bytes RAW para a fila da impressora (datatype RAW).
 * @param {Buffer} data
 * @param {{ printerName?: string, docName?: string }} [options]
 */
export function printRaw(data, options = {}) {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new Error('Conteúdo de impressão vazio.')
  }

  const printerName = resolvePrinterName(options.printerName)
  const docName = options.docName || 'PDV Cupom'
  const phPrinter = [null]

  const opened = OpenPrinterW(printerName, phPrinter, null)
  if (!opened || !phPrinter[0]) {
    throw new Error(
      `Não foi possível abrir a impressora "${printerName}".${lastErrorMessage()} Verifique se ela está ligada e instalada.`,
    )
  }

  const hPrinter = phPrinter[0]
  try {
    const docInfo = {
      pDocName: docName,
      pOutputFile: null,
      pDatatype: 'RAW',
    }
    const jobId = StartDocPrinterW(hPrinter, 1, docInfo)
    if (!jobId) {
      throw new Error(
        `Falha ao iniciar documento na impressora "${printerName}".${lastErrorMessage()}`,
      )
    }

    try {
      if (!StartPagePrinter(hPrinter)) {
        throw new Error('Falha ao iniciar página de impressão.')
      }
      try {
        const written = [0]
        const ok = WritePrinter(hPrinter, data, data.length, written)
        if (!ok || written[0] !== data.length) {
          throw new Error(
            `Falha ao enviar dados RAW (${written[0] || 0}/${data.length} bytes).`,
          )
        }
      } finally {
        EndPagePrinter(hPrinter)
      }
    } finally {
      EndDocPrinter(hPrinter)
    }
  } finally {
    ClosePrinter(hPrinter)
  }

  return { ok: true, printerName, bytes: data.length }
}
