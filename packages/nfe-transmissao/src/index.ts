/**
 * @modulo/nfe-transmissao
 *
 * Rotina portátil de transmissão NFC-e / NF-e.
 * Sem Next.js / Supabase — reutilizável em qualquer projeto da empresa (Node 18+).
 *
 * API principal (SEFAZ real):
 *   import { emitirNfce } from "@modulo/nfe-transmissao";
 *
 * Orquestração genérica (mock ou transmitter injetado):
 *   import { transmitirDocumentoFiscal, createSefazTransmitter } from "@modulo/nfe-transmissao";
 */
export {
  decidirTipoDocumento,
  modeloCodigo,
  onlyDigitsDoc,
} from "./decidirTipo";
export { createMockTransmitter } from "./mockTransmitter";
export { createSefazTransmitter } from "./sefaz/transmitter.mjs";
export { montarReceitasFromPayments } from "./receitas";
export { transmitirDocumentoFiscal } from "./transmitir";
export type { TransmitirOptions } from "./transmitir";
export { emitirNfce, transmitirNfce } from "./emitirNfce";
export type { EmitirNfceInput } from "./emitirNfce";
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

export {
  buildInfNFeXml,
  buildQrCodeUrl,
  hashCscQr,
  assinarNFeXml,
  extractPfxPem,
  autorizarNfce,
  buildChaveAcesso,
  nfceAutorizacaoUrl,
  onlyDigits,
  ufToIbge,
} from "./sefaz/index";
