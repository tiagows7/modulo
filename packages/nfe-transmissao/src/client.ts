/**
 * Entrada segura para o browser / Client Components.
 * Não importa node:crypto, node:https, node:module, forge nem xml-crypto.
 *
 * Uso:
 *   import { decidirTipoDocumento, transmitirDocumentoFiscal } from "@modulo/nfe-transmissao/client";
 *
 * SEFAZ real: importe de `@modulo/nfe-transmissao` (somente em API/route Node).
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
