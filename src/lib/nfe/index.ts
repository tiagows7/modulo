/**
 * Kit NF-e compartilhado do pdv-web.
 *
 * - Distribuição DF-e (entrada): `@modulo/nfe-distribuicao-dfe`
 * - Transmissão NFC-e / NF-e (saída): `@modulo/nfe-transmissao`
 *
 * Browser: use `@/lib/nfe/transmissao` (client-safe).
 * Node/API: use `@/lib/nfe/transmissao-sefaz` ou `@modulo/nfe-transmissao`.
 */
export {
  consultarDistribuicaoDfe,
  decodeDocZip,
  distribuirDfePorNsu,
  docFromDistXml,
  maxNsu,
  onlyDigitsNfe,
  padNsu,
  parseDistResponse,
  resolveTpAmb,
  ufToIbge,
  type DistDfeDoc,
  type DistDfeResult,
  type DistribuirDfePorNsuInput,
} from "./distribuicaoDfe";

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
} from "./transmissao";

export {
  assinarNFeXml,
  autorizarNfce,
  buildChaveAcesso,
  buildInfNFeXml,
  buildQrCodeUrl,
  createSefazTransmitter,
  emitirNfce,
  extractPfxPem,
  hashCscQr,
  nfceAutorizacaoUrl,
  nfeAutorizacaoUrl,
  onlyDigits,
  transmitirNfce,
  type EmitirNfceInput,
} from "./transmissao-sefaz";

export {
  parseNfeXml,
  type NfeXmlItem,
  type NfeXmlParsed,
  type NfeXmlTotais,
} from "./parseNfeXml";

export { ensureFornecedorFromNfe } from "./ensureFornecedorFromNfe";

export {
  classificarItensXml,
  fatorVolumeVinculo,
} from "./xmlProdutoVinculo";
