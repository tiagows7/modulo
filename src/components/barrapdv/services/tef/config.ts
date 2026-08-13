/**
 * Configuração TEF (CliSiTef / Fiserv — molde AppSiTef).
 * Browser → ponte local → CliSiTef64I.dll / pinpad.
 */
export const TEF_CONFIG = {
  /**
   * mock = simula pinpad/PIX na ponte (dev sem DLL)
   * live = CliSiTef64I.dll em server/clisitef64/
   */
  mode: 'live' as 'mock' | 'live',
  /** URL da ponte local Windows */
  bridgeUrl: 'http://127.0.0.1:39101',
  /** IP do servidor SiTef (simulado ou real) */
  sitefIp: '192.168.1.7',
  /** Código da loja SiTef */
  storeId: '00000000',
  /** Número do terminal */
  terminalId: 'PDV0002',
  /** Operador padrão */
  defaultOperator: 'CAIXA',
  /** Intervalo de poll do status (ms) */
  pollIntervalMs: 800,
}
