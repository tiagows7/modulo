/**
 * Configuração do concentrador Companytec CBC.
 */

const POSTO_WEB_PORT = '39199'

function resolveBridgeUrls() {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location
    // PDV pelo proxy local do posto → same-origin, sem certificado / sem mixed content
    if (
      (hostname === '127.0.0.1' || hostname === 'localhost') &&
      port === POSTO_WEB_PORT
    ) {
      const base = `${protocol}//${hostname}:${port}/__local/cbc`
      return { bridgeUrl: base, bridgeUrlHttp: base }
    }
    // Next/dev local na própria máquina
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      return {
        bridgeUrl: 'http://127.0.0.1:39100',
        bridgeUrlHttp: 'http://127.0.0.1:39100',
      }
    }
  }

  // Vercel/HTTPS remoto: tenta HTTPS local (fallback HTTP costuma falhar por mixed content)
  return {
    bridgeUrl: 'https://127.0.0.1:39110',
    bridgeUrlHttp: 'http://127.0.0.1:39100',
  }
}

const resolved = resolveBridgeUrls()

export const CBC_CONFIG = {
  mode: 'tcp' as const,
  /** IP do concentrador Companytec CBC (mesmo do CBCManager) */
  host: '192.168.1.150',
  /** Porta TCP usada pelo CBCManager2K9 (não é 2001 neste equipamento) */
  port: 1771,
  /** Intervalo de varredura no PDV (ms) */
  pollIntervalMs: 1500,
  defaultOperator: 'Carlos Silva',
  /** URL HTTP da ponte (ferramentas locais) */
  bridgeUrlHttp: resolved.bridgeUrlHttp,
  /**
   * URL da ponte CBC.
   * No caixa use http://127.0.0.1:39199/pdv (proxy local) — sem certificado.
   */
  bridgeUrl: resolved.bridgeUrl,
  /** Recalcula em runtime (útil se o bundle carregar antes do window). */
  resolveBridgeUrls,
}
