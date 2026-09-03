/**
 * Reexporta a rotina portátil de transmissão NFC-e / NF-e.
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
} from "@modulo/nfe-transmissao";
