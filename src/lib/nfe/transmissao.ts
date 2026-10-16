/**
 * Reexporta a API segura para o browser (mock + regras de modelo).
 * Não puxa assinatura A1 / SEFAZ (node:module, forge, xml-crypto).
 *
 * Para APIs Node: importe de `@modulo/nfe-transmissao` ou `@/lib/nfe/transmissao-sefaz`.
 */
export {
  createMockTransmitter,
  decidirTipoDocumento,
  modeloCodigo,
  montarReceitasFromPayments,
  onlyDigitsDoc,
  transmitirDocumentoFiscal,
  type AmbienteSefaz,
  type DocumentoFiscalTransmitido,
  type FiscalTransmitter,
  type ModeloFiscal,
  type ReceitaFiscalLinha,
  type TransmitBuyer,
  type TransmitEmitente,
  type TransmitItem,
  type TransmitPayment,
  type TransmitTefReceita,
  type TransmitirOptions,
  type TransmitirVendaInput,
  type TransmitirVendaResult,
} from "@modulo/nfe-transmissao/client";
