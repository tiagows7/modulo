/**
 * Kit NF-e compartilhado do pdv-web.
 *
 * - Distribuição DF-e (entrada): `@modulo/nfe-distribuicao-dfe`
 * - Transmissão NFC-e / NF-e (saída): `@modulo/nfe-transmissao`
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
  assinarNFeXml,
  autorizarNfce,
  buildChaveAcesso,
  buildInfNFeXml,
  buildQrCodeUrl,
  createMockTransmitter,
  createSefazTransmitter,
  decidirTipoDocumento,
  emitirNfce,
  extractPfxPem,
  hashCscQr,
  modeloCodigo,
  montarReceitasFromPayments,
  nfceAutorizacaoUrl,
  onlyDigits,
  onlyDigitsDoc,
  transmitirDocumentoFiscal,
  transmitirNfce,
  type AmbienteSefaz,
  type DocumentoFiscalTransmitido,
  type EmitirNfceInput,
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
