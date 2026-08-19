/**
 * Configuração da ponte SmartPOS (maquininhas).
 * Abastecimentos: lógica Delphi + Supabase (sem Firebird).
 * Venda: stubs de untSrvMetodosGerais.pas (próxima fatia).
 */
export const SMARTPOS_CONFIG = {
  mode: 'live' as 'stub' | 'live',
  bridgeUrl: 'http://127.0.0.1:39103',
}
