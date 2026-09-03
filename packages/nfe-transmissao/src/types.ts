/** Tipos compartilhados da rotina de transmissão NFC-e / NF-e. */

export type ModeloFiscal = "NFC-e" | "NF-e";

export type AmbienteSefaz = 1 | 2; // 1 produção · 2 homologação

export type TransmitItem = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  unit?: string;
  kind?: "combustivel" | "produto" | string;
  productCode?: string | number;
  discount?: number;
  ncm?: string;
  cfop?: string;
  pumpId?: string | number;
};

export type TransmitBuyer = {
  document?: string | null;
  name?: string | null;
  email?: string | null;
  ie?: string | null;
  customerCode?: string | null;
  cep?: string | null;
  address?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  uf?: string | null;
  phone?: string | null;
};

/**
 * Dados TEF / cartão para receita (CliSiTef).
 * campo_131 = REDE_DESTINO · campo_132 = TIPO_CARTAO
 */
export type TransmitTefReceita = {
  campo_131?: string | null;
  campo_132?: string | null;
  recebimento_cartao?: number | null;
  data_prevista?: string | null; // YYYY-MM-DD
  modalidade?: string | null;
  bin_rede?: string | null;
  data_cartao?: string | null; // AAAAMMDD
  hora_cartao?: string | null; // HHMMSS
  autorizacao?: string | null;
  taxa_cartao?: number | null;
  bandeira?: string | null;
  nsu?: string | null;
};

export type TransmitPayment = {
  methodId: string;
  label?: string;
  amount: number;
  /** true quando veio de TEF / cartão */
  isTef?: boolean;
  nsu?: string;
  authorizationCode?: string;
  brand?: string;
  tef?: TransmitTefReceita;
};

export type TransmitEmitente = {
  cnpj: string;
  ie?: string | null;
  razaoSocial?: string | null;
  fantasia?: string | null;
  uf?: string | null;
  municipioIbge?: string | null;
};

export type TransmitirVendaInput = {
  /** Se omitido, decide por CPF/CNPJ do destinatário. */
  tipo?: ModeloFiscal;
  items: TransmitItem[];
  payments: TransmitPayment[];
  buyer?: TransmitBuyer;
  saleRef: string;
  operator?: string | null;
  total?: number;
  serie?: string;
  /** tpAmb: 1 produção · 2 homologação */
  ambiente?: AmbienteSefaz;
  emitente?: TransmitEmitente;
  /** Contexto PDV (persistência no host). */
  pdvCodigo?: string | null;
  filialId?: string | null;
};

export type DocumentoFiscalTransmitido = {
  id: string;
  tipo: ModeloFiscal;
  modelo: "65" | "55";
  numero: number;
  serie: string;
  chave: string;
  protocolo?: string;
  ambiente: AmbienteSefaz;
  status: "authorized" | "denied" | "contingency" | "error" | "pending";
  valor: number;
  cliente: string;
  buyerDocument?: string;
  buyerEmail?: string;
  saleRef: string;
  issuedAt: string;
  emissao: string;
  hora: string;
  items: TransmitItem[];
  payments: TransmitPayment[];
  xml?: string;
  digVal?: string;
  error?: string | null;
};

/** Linha pronta para gravar em receitas_nfce / receitas_nfe. */
export type ReceitaFiscalLinha = {
  n_item: number;
  forma_pagamento: string;
  method_id: string;
  label: string | null;
  valor: number;
  situacao: string;
  campo_131: string | null;
  campo_132: string | null;
  recebimento_cartao: number;
  data_prevista: string | null;
  modalidade: string | null;
  bin_rede: string | null;
  data_cartao: string | null;
  hora_cartao: string | null;
  autorizacao: string | null;
  taxa_cartao: number;
  bandeira: string | null;
  nsu: string | null;
  sale_ref: string | null;
};

export type TransmitirVendaResult = {
  document: DocumentoFiscalTransmitido;
  receitas: ReceitaFiscalLinha[];
  message: string;
};

export type FiscalTransmitter = {
  transmit(input: TransmitirVendaInput & { tipo: ModeloFiscal }): Promise<{
    document: DocumentoFiscalTransmitido;
    message: string;
  }>;
};
