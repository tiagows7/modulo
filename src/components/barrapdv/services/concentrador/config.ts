/**
 * Configuração do concentrador Companytec CBC.
 */
export const CBC_CONFIG = {
  mode: 'tcp' as const,
  /** IP do concentrador Companytec CBC (mesmo do CBCManager) */
  host: '192.168.1.150',
  /** Porta TCP usada pelo CBCManager2K9 (não é 2001 neste equipamento) */
  port: 1771,
  /** Intervalo de varredura no PDV (ms) */
  pollIntervalMs: 2000,
  defaultOperator: 'Carlos Silva',
  /** URL HTTP da ponte (ferramentas locais) */
  bridgeUrlHttp: 'http://127.0.0.1:39100',
  /**
   * URL HTTPS da ponte — necessária quando o PDV abre no Vercel (HTTPS).
   * O navegador bloqueia HTTP localhost a partir de páginas HTTPS.
   */
  bridgeUrl: 'https://127.0.0.1:39110',
}
