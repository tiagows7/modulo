/**
 * Reexporta o cliente portátil de distribuição DF-e.
 * Prefira importar de `@/lib/nfe` ou `@modulo/nfe-distribuicao-dfe`.
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
} from "@modulo/nfe-distribuicao-dfe";
