import { fuels } from '../../data/mock'
import { CBC_CONFIG } from './config'
import { tempFillingTable } from './tempFillingTable'
import { PRODUCT_MAP, NOZZLE_FUEL_MAP } from './productMaps'
import {
  listAbastecimentosAbertos,
  markAbastecimentoUsado,
  reabrirAbastecimentosDb,
  rowToTempFilling,
  upsertFromCbcSupplies,
  loadBicosCadastroMap,
  resolveBicoNumero,
  normalizeBicoCode,
} from './abastecimentosDb'
import type {
  CbcConfig,
  CbcConnectionState,
  CbcSupplyPayload,
  TempFilling,
} from './types'

type StateListener = (state: CbcConnectionState) => void


/**
 * Cliente Companytec CBC.
 *
 * Modo `mock`: simula respostas do concentrador e grava na tabela temporária.
 * Modo `tcp`: usa ponte local → IP do CBC (192.168.1.150:1771).
 *
 * Ponte local implementa o protocolo socket do kit:
 * - (&Hddhhmm) sync de relógio
 * - (&A67) leitura de abastecimentos
 * - (&Sxx) status · ACK via (&I…)
 */
export class CompanytecCbcClient {
  private config: CbcConfig
  private timer: number | null = null
  private mockTick = 0
  private polling = false
  private wasOffline = false
  private recoverHandlersBound = false
  private state: CbcConnectionState
  private stateListeners = new Set<StateListener>()

  constructor(config: Partial<CbcConfig> = {}) {
    this.config = {
      mode: CBC_CONFIG.mode,
      host: CBC_CONFIG.host,
      port: CBC_CONFIG.port,
      pollIntervalMs: CBC_CONFIG.pollIntervalMs,
      defaultOperator: CBC_CONFIG.defaultOperator,
      ...config,
    }
    this.state = {
      connected: false,
      mode: this.config.mode,
      lastPollAt: null,
      lastError: null,
      message: `CBC ${this.config.host}:${this.config.port} — parado`,
      nozzles: [],
    }
  }

  getConfig() {
    return { ...this.config }
  }

  getState() {
    return { ...this.state }
  }

  subscribeState(listener: StateListener) {
    this.stateListeners.add(listener)
    listener(this.getState())
    return () => this.stateListeners.delete(listener)
  }

  private setState(patch: Partial<CbcConnectionState>) {
    this.state = { ...this.state, ...patch }
    const snapshot = this.getState()
    this.stateListeners.forEach((fn) => fn(snapshot))
  }

  /** Força sync: banco → grid + poll CBC (usado após queda/volta). */
  async forceSync() {
    try {
      const rows = await listAbastecimentosAbertos()
      tempFillingTable.replaceAll(rows.map(rowToTempFilling))
    } catch (err) {
      console.warn('[CBC] forceSync DB:', err)
    }
    await this.poll({ force: true })
  }

  private bindRecoverHandlers() {
    if (this.recoverHandlersBound || typeof window === 'undefined') return
    this.recoverHandlersBound = true
    const kick = () => {
      void this.forceSync()
    }
    window.addEventListener('online', kick)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') kick()
    })
  }

  start() {
    if (this.timer != null) return

    this.bindRecoverHandlers()

    // Em TCP, carrega abertos do banco (não depende só do localStorage)
    if (this.config.mode === 'tcp') {
      tempFillingTable.clear()
      void listAbastecimentosAbertos()
        .then((rows) => tempFillingTable.replaceAll(rows.map(rowToTempFilling)))
        .catch(() => undefined)
    }

    // No modo simulado, começa zerado — só entra o que o CBC mock enviar
    if (this.config.mode === 'mock') {
      tempFillingTable.clear()
      this.mockTick = 0
    }

    this.setState({
      connected: false,
      mode: this.config.mode,
      lastError: null,
      message:
        this.config.mode === 'mock'
          ? `CBC simulação · aguardando abastecimentos`
          : `Conectando CBC ${this.config.host}:${this.config.port}…`,
    })
    void this.poll({ force: true })
    this.timer = window.setInterval(() => {
      void this.poll()
    }, this.config.pollIntervalMs)
  }

  stop() {
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.setState({
      connected: false,
      message: `CBC ${this.config.host}:${this.config.port} — parado`,
    })
  }

  /**
   * Ciclo de varredura — CBC → public.abastecimentos → grid.
   */
  async poll(opts?: { force?: boolean }) {
    if (this.polling) {
      if (!opts?.force) return
      // force: espera o ciclo atual terminar (até ~12s) e tenta de novo
      const started = Date.now()
      while (this.polling && Date.now() - started < 12000) {
        await delay(200)
      }
      if (this.polling) return
    }
    this.polling = true
    try {
      if (this.config.mode === 'mock') {
        const supplies = await this.pollMock()
        await this.persistAndReload(supplies)
        this.wasOffline = false
        this.setState({
          connected: true,
          lastPollAt: new Date().toISOString(),
          lastError: null,
          nozzles: this.mockNozzleStatuses(),
          message: `Simulação CBC · ${tempFillingTable.countDisponiveis()} disponíveis`,
        })
        return
      }

      const { supplies, nozzles, online, error } = await this.pollTcpBridge()
      // Sempre tenta gravar o que veio (inclusive cache da ponte em queda)
      await this.persistAndReload(supplies)

      if (!online) {
        this.wasOffline = true
        // Mesmo offline, mantém grid alinhado com o banco
        try {
          const rows = await listAbastecimentosAbertos()
          tempFillingTable.replaceAll(rows.map(rowToTempFilling))
        } catch {
          /* ignore */
        }
        this.setState({
          connected: false,
          lastPollAt: new Date().toISOString(),
          lastError: error || 'Sem conexão com o concentrador',
          nozzles: [],
          message: `CBC offline — ${error || 'sem conexão'} · ${tempFillingTable.countDisponiveis()} em aberto`,
        })
        return
      }

      const mapped = await this.mapNozzlesToCadastro(nozzles)
      const recovered = this.wasOffline
      this.wasOffline = false

      // Após voltar online, um segundo drain pega o que ficou na fila do CBC
      if (recovered) {
        try {
          const again = await this.pollTcpBridge()
          if (again.supplies.length) {
            await this.persistAndReload(again.supplies)
          }
        } catch (err) {
          console.warn('[CBC] poll pós-reconexão:', err)
        }
      }

      this.setState({
        connected: true,
        lastPollAt: new Date().toISOString(),
        lastError: null,
        nozzles: mapped,
        message: `CBC ${this.config.host}:${this.config.port} online · ${tempFillingTable.countDisponiveis()} disponíveis`,
      })
    } catch (err) {
      this.wasOffline = true
      const message = err instanceof Error ? err.message : 'Erro na comunicação CBC'
      // Em falha dura, ainda tenta mostrar abertos do banco
      try {
        const rows = await listAbastecimentosAbertos()
        tempFillingTable.replaceAll(rows.map(rowToTempFilling))
      } catch {
        /* ignore */
      }
      this.setState({
        connected: false,
        lastError: message,
        nozzles: [],
        message: `CBC offline — ${message}`,
      })
    } finally {
      this.polling = false
    }
  }

  /** Persistência Supabase + refresh do grid (situacao=0). */
  private async persistAndReload(supplies: CbcSupplyPayload[]) {
    try {
      const persistedIds = await upsertFromCbcSupplies(supplies, {
        defaultOperator: this.config.defaultOperator,
      })
      const rows = await listAbastecimentosAbertos()
      tempFillingTable.replaceAll(rows.map(rowToTempFilling))

      // ACK só do que realmente gravou / já estava baixado — senão perde na ponte
      if (this.config.mode === 'tcp' && persistedIds.length) {
        try {
          await this.sendBridgeCommand('ACK_SUPPLIES', {
            supplyIds: persistedIds,
          })
        } catch (err) {
          console.warn('[CBC] ACK_SUPPLIES falhou:', err)
        }
      }
    } catch (err) {
      console.warn('[CBC] Falha ao sincronizar abastecimentos:', err)
      const local = supplies
        .filter((s) => s.status !== 'abastecendo')
        .map((s) => this.toTempFilling(s))
      if (local.length) tempFillingTable.upsertMany(local)
    }
  }

  /**
   * Confirma/baixa abastecimento no CBC após lançar no cupom ou baixar sem nota.
   * Marca situacao = 1 em public.abastecimentos.
   */
  async acknowledgeSupply(fillingId: string) {
    const row = tempFillingTable.getById(fillingId)
    if (!row || row.situacao === 1) return

    if (this.config.mode === 'tcp') {
      try {
        await this.sendBridgeCommand('ACK_SUPPLY', { supplyId: row.cbcSupplyId })
      } catch {
        /* segue com baixa no banco */
      }
    }

    try {
      await markAbastecimentoUsado(fillingId)
    } catch (err) {
      console.warn('[CBC] mark usado DB:', err)
    }
    tempFillingTable.markAsUsado(fillingId)
  }

  /** Baixa o abastecimento sem lançar no cupom / emitir nota. */
  async baixaSemNota(fillingId: string) {
    await this.acknowledgeSupply(fillingId)
  }

  async reabrirSupplies(ids: string[]) {
    try {
      await reabrirAbastecimentosDb(ids)
    } catch (err) {
      console.warn('[CBC] reabrir DB:', err)
    }
    tempFillingTable.reabrirMany(ids)
  }

  private toTempFilling(payload: CbcSupplyPayload): TempFilling {
    const fuelId =
      PRODUCT_MAP[payload.productCode] ??
      NOZZLE_FUEL_MAP[payload.nozzle] ??
      'gc'
    const fuel = fuels.find((f) => f.id === fuelId)
    const now = new Date()
    const unitPrice = payload.unitPrice || fuel?.price || 0
    const total =
      payload.total || Number((payload.liters * unitPrice).toFixed(2))
    const bico = (payload.bicoCode || String(payload.nozzle)).padStart(2, '0')
    const numero =
      Number.parseInt(String(payload.supplyId).replace(/\D/g, ''), 10) || 0

    return {
      id: `cbc-${bico}-${numero || payload.supplyId}`,
      nozzle: payload.nozzle,
      fuelId,
      cbcProductCode: payload.productCode,
      quantity: payload.liters,
      unitPrice,
      total,
      date: payload.date || now.toLocaleDateString('pt-BR'),
      time:
        payload.time ||
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      operator: this.config.defaultOperator,
      status: payload.status,
      situacao: 0,
      cbcSupplyId: payload.supplyId,
      source: 'companytec-cbc',
      receivedAt: now.toISOString(),
      medicao: payload.medicao ?? null,
      cartaoAbastecimento: payload.cartaoAbastecimento ?? null,
    }
  }

  /** Simula leitura de abastecimentos pendentes do CBC */
  private async pollMock(): Promise<CbcSupplyPayload[]> {
    this.mockTick += 1
    const supplies: CbcSupplyPayload[] = []

    // Abastecimento em andamento (atualiza o mesmo bico)
    if (this.mockTick % 2 === 0) {
      supplies.push({
        supplyId: `LIVE-${(this.mockTick % 8) + 1}`,
        nozzle: (this.mockTick % 8) + 1,
        productCode: String(((this.mockTick % 5) + 1)).padStart(2, '0'),
        liters: Number((5 + (this.mockTick % 20) + 0.35).toFixed(2)),
        unitPrice: 0,
        total: 0,
        status: 'abastecendo',
      })
    }

    // Novo abastecimento finalizado enviado pelo CBC simulado
    if (this.mockTick % 4 === 0) {
      const nozzle = (this.mockTick % 8) + 1
      const productCode = String(((this.mockTick % 5) + 1)).padStart(2, '0')
      const fuelId = PRODUCT_MAP[productCode] ?? 'gc'
      const fuel = fuels.find((f) => f.id === fuelId)
      const liters = Number((15 + (this.mockTick % 40) + 0.12).toFixed(2))
      const unitPrice = fuel?.price ?? 5.89
      supplies.push({
        supplyId: `SUP-${Date.now()}-${nozzle}`,
        nozzle,
        productCode,
        liters,
        unitPrice,
        total: Number((liters * unitPrice).toFixed(2)),
        status: 'disponivel',
      })
    }

    await delay(40)
    return supplies
  }

  /**
   * Converte código do bico do concentrador → número do cadastro de bicos
   * (ex.: CBC 04 → cadastro 01).
   */
  private async mapNozzlesToCadastro(
    nozzles: import('./types').CbcNozzleStatus[],
  ): Promise<import('./types').CbcNozzleStatus[]> {
    if (!nozzles.length) return nozzles
    try {
      const map = await loadBicosCadastroMap()
      return nozzles.map((n) => {
        const conc = normalizeBicoCode(n.bicoCode || n.nozzle)
        const numero = resolveBicoNumero(map, conc)
        const nozzleNum = Number.parseInt(numero.replace(/\D/g, ''), 10)
        return {
          ...n,
          bicoCode: numero || conc,
          nozzle: Number.isFinite(nozzleNum) && nozzleNum > 0 ? nozzleNum : n.nozzle,
        }
      })
    } catch (err) {
      console.warn('[CBC] map bicos cadastro:', err)
      return nozzles
    }
  }

  /** Consulta a ponte local → 192.168.1.150:1771 */
  private async pollTcpBridge(): Promise<{
    supplies: CbcSupplyPayload[]
    nozzles: import('./types').CbcNozzleStatus[]
    online: boolean
    error?: string
  }> {
    const { bridgeUrl, bridgeUrlHttp } = CBC_CONFIG.resolveBridgeUrls()
    const urls = [
      `${bridgeUrl}/cbc/poll` +
        `?host=${encodeURIComponent(this.config.host)}` +
        `&port=${this.config.port}`,
    ]
    if (bridgeUrlHttp !== bridgeUrl) {
      urls.push(
        `${bridgeUrlHttp}/cbc/poll` +
          `?host=${encodeURIComponent(this.config.host)}` +
          `&port=${this.config.port}`,
      )
    }

    let response: Response | null = null
    let lastNetworkError: Error | null = null
    for (const url of urls) {
      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 15000)
        try {
          response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
          })
        } finally {
          window.clearTimeout(timeoutId)
        }
        break
      } catch (err) {
        lastNetworkError =
          err instanceof Error ? err : new Error(String(err))
      }
    }

    if (!response) {
      throw new Error(
        lastNetworkError?.name === 'AbortError'
          ? `Timeout na ponte CBC (${this.config.host}:${this.config.port})`
          : lastNetworkError?.message?.includes('Failed to fetch') ||
              lastNetworkError?.message?.includes('NetworkError')
            ? `Ponte CBC bloqueada. Abra o PDV em http://127.0.0.1:39199/pdv`
            : `Ponte CBC offline. Aguarde o watchdog local (http://127.0.0.1:39199/pdv).`,
      )
    }

    let data: {
      ok?: boolean
      connected?: boolean
      error?: string
      supplies?: CbcSupplyPayload[]
      nozzles?: import('./types').CbcNozzleStatus[]
    } = {}
    try {
      data = (await response.json()) as typeof data
    } catch {
      // corpo inválido
    }

    const supplies = data.supplies ?? []
    const nozzles = data.nozzles ?? []
    const online =
      response.ok && data.ok !== false && data.connected !== false

    // Em queda, a ponte ainda devolve o cache pending — não descartar
    if (!online && !supplies.length) {
      throw new Error(
        data.error ||
          `Sem conexão com ${this.config.host}:${this.config.port}`,
      )
    }

    return {
      supplies,
      nozzles,
      online,
      error: data.error,
    }
  }

  private mockNozzleStatuses(): import('./types').CbcNozzleStatus[] {
    return Array.from({ length: 8 }, (_, i) => {
      const nozzle = i + 1
      const live = this.mockTick % 8 === i
      const bicoCode = String(nozzle).padStart(2, '0')
      return {
        nozzle,
        bicoCode,
        code: live ? 'A' : 'L',
        status: live ? 'abastecendo' : 'livre',
      }
    })
  }

  private async sendBridgeCommand(
    command: string,
    payload: Record<string, string | string[]> = {},
  ) {
    const { bridgeUrl, bridgeUrlHttp } = CBC_CONFIG.resolveBridgeUrls()
    const body = JSON.stringify({
      command,
      host: this.config.host,
      port: this.config.port,
      ...payload,
    })
    const urls = [bridgeUrl, bridgeUrlHttp].filter(
      (u, i, arr) => arr.indexOf(u) === i,
    ).map((base) => `${base}/cbc/command`)
    let response: Response | null = null
    for (const url of urls) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        break
      } catch {
        /* tenta próxima URL */
      }
    }
    if (!response) {
      throw new Error(
        `Ponte CBC offline. Abra o PDV em http://127.0.0.1:39199/pdv`,
      )
    }
    if (!response.ok) {
      throw new Error(`Falha ao enviar comando CBC (${response.status})`)
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const companytecCbc = new CompanytecCbcClient()
