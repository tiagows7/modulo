/**
 * Kit NF-e compartilhado do pdv-web.
 * Distribuição DF-e: pacote portátil `@modulo/nfe-distribuicao-dfe`.
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
