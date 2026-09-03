/**
 * @modulo/nfe-transmissao
 *
 * Rotina portátil de transmissão NFC-e / NF-e.
 * Sem Next.js / Supabase — reutilizável em qualquer projeto da empresa.
 */
export {
  decidirTipoDocumento,
  modeloCodigo,
  onlyDigitsDoc,
} from "./decidirTipo";
export { createMockTransmitter } from "./mockTransmitter";
export { montarReceitasFromPayments } from "./receitas";
export { transmitirDocumentoFiscal } from "./transmitir";
export type { TransmitirOptions } from "./transmitir";
export type {
  AmbienteSefaz,
  DocumentoFiscalTransmitido,
  FiscalTransmitter,
  ModeloFiscal,
  ReceitaFiscalLinha,
  TransmitBuyer,
  TransmitEmitente,
  TransmitItem,
  TransmitPayment,
  TransmitTefReceita,
  TransmitirVendaInput,
  TransmitirVendaResult,
} from "./types";
