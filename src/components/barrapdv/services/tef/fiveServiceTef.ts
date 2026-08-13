import { TEF_CONFIG } from './config'
import type { TefStartRequest, TefTransactionState } from './types'

/**
 * Cliente TEF FiveService via ponte local (mesmo padrão do CBC).
 */
class FiveServiceTefClient {
  private polling: ReturnType<typeof setInterval> | null = null

  get bridgeUrl() {
    return TEF_CONFIG.bridgeUrl.replace(/\/$/, '')
  }

  async health(): Promise<{ ok: boolean; mode: string; message: string }> {
    try {
      const res = await fetch(`${this.bridgeUrl}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { ok: boolean; mode: string; message: string }
    } catch (err) {
      return {
        ok: false,
        mode: TEF_CONFIG.mode,
        message:
          err instanceof Error
            ? err.message
            : 'Ponte TEF offline — rode npm run tef-bridge',
      }
    }
  }

  async start(request: TefStartRequest): Promise<TefTransactionState> {
    const res = await fetch(`${this.bridgeUrl}/tef/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        sitefIp: TEF_CONFIG.sitefIp,
        storeId: TEF_CONFIG.storeId,
        terminalId: TEF_CONFIG.terminalId,
        operator: request.operator || TEF_CONFIG.defaultOperator,
        mode: TEF_CONFIG.mode,
      }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao iniciar TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  async status(transactionId: string): Promise<TefTransactionState> {
    const res = await fetch(
      `${this.bridgeUrl}/tef/status/${encodeURIComponent(transactionId)}`,
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao consultar TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  async confirm(transactionId: string): Promise<TefTransactionState> {
    const res = await fetch(
      `${this.bridgeUrl}/tef/confirm/${encodeURIComponent(transactionId)}`,
      { method: 'POST' },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao confirmar TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  async cancel(transactionId: string): Promise<TefTransactionState> {
    const res = await fetch(
      `${this.bridgeUrl}/tef/cancel/${encodeURIComponent(transactionId)}`,
      { method: 'POST' },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao cancelar TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  /** Volta à etapa anterior da coleta CliSiTef (ContinuaFuncao = 1). */
  async goBack(transactionId: string): Promise<TefTransactionState> {
    const res = await fetch(
      `${this.bridgeUrl}/tef/back/${encodeURIComponent(transactionId)}`,
      { method: 'POST' },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao voltar etapa TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  /** Responde menu / coleta do operador (ex.: opção "2" = Débito). */
  async submitInput(transactionId: string, value: string): Promise<TefTransactionState> {
    const res = await fetch(
      `${this.bridgeUrl}/tef/input/${encodeURIComponent(transactionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Falha ao enviar opção TEF (${res.status})`)
    }
    return (await res.json()) as TefTransactionState
  }

  /**
   * Poll até status terminal. Retorna o estado final.
   */
  watch(
    transactionId: string,
    onUpdate: (state: TefTransactionState) => void,
  ): Promise<TefTransactionState> {
    this.stopWatch()
    return new Promise((resolve, reject) => {
      const tick = async () => {
        try {
          const state = await this.status(transactionId)
          onUpdate(state)
          if (
            state.status === 'approved' ||
            state.status === 'denied' ||
            state.status === 'cancelled' ||
            state.status === 'error'
          ) {
            this.stopWatch()
            resolve(state)
          }
        } catch (err) {
          this.stopWatch()
          reject(err)
        }
      }
      void tick()
      this.polling = setInterval(() => void tick(), TEF_CONFIG.pollIntervalMs)
    })
  }

  stopWatch() {
    if (this.polling) {
      clearInterval(this.polling)
      this.polling = null
    }
  }
}

export const fiveServiceTef = new FiveServiceTefClient()
