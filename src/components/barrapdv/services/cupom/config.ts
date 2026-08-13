/**
 * Cupom de desconto — mesma API do PDV Delphi (ValidarCupom).
 * A API exige codigo_gerado + cnpj_posto (não podem faltar).
 */
export const CUPOM_CONFIG = {
  /** POST body: { codigo_gerado, cnpj_posto } */
  validarUrl: 'https://josmwljxjmazingfizmc.supabase.co/functions/v1/validar-cupom',
  /** Proxy Vite (evita CORS no dev). */
  proxyUrl: '/api/validar-cupom',
  authorization: 'Bearer sk_firebird_8f93b2a1a4c9d5e6',
  /**
   * CNPJ fixo do posto enviado na API (obrigatório).
   * O PDV web ainda não filtra desconto por CNPJ/produto.
   */
  cnpjPostoFallback: '93013845000100',
}
