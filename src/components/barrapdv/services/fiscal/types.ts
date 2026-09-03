import type { CartItem } from '../../data/mock'

/** Tipo do documento fiscal eletrônica. */
export type FiscalDocTipo = 'NFC-e' | 'NF-e'

export type FiscalDocStatus =
  | 'authorized'
  | 'denied'
  | 'contingency'
  | 'cancelled'
  | 'error'
  | 'pending'

export type FiscalBuyer = {
  document?: string
  name?: string
  customerCode?: string
  email?: string
  ie?: string
  cep?: string
  address?: string
  number?: string
  neighborhood?: string
  city?: string
  uf?: string
  phone?: string
  plate?: string
  km?: string
  fleet?: string
  driver?: string
  notes?: string
}

export type FiscalPaymentLine = {
  methodId: string
  label?: string
  amount: number
  nsu?: string
  authorizationCode?: string
  brand?: string
  /** Pagamento originado de TEF / cartão */
  isTef?: boolean
  /** Dados CliSiTef para receitas_nfce / receitas_nfe */
  tef?: {
    campo_131?: string | null
    campo_132?: string | null
    recebimento_cartao?: number | null
    data_prevista?: string | null
    modalidade?: string | null
    bin_rede?: string | null
    data_cartao?: string | null
    hora_cartao?: string | null
    autorizacao?: string | null
    taxa_cartao?: number | null
    bandeira?: string | null
    nsu?: string | null
  }
}

export type FiscalEmitRequest = {
  /** Se omitido, o serviço sugere NFC-e ou NF-e pelo destinatário. */
  tipo?: FiscalDocTipo
  items: CartItem[]
  buyer?: FiscalBuyer
  payments: FiscalPaymentLine[]
  /** Referência da venda / cupom PDV (correlação TEF). */
  saleRef: string
  operator?: string
  /** Total da venda; se omitido, soma dos itens. */
  total?: number
}

export type FiscalDocument = {
  id: string
  tipo: FiscalDocTipo
  numero: string
  serie: string
  chave: string
  emissao: string
  hora: string
  valor: number
  cliente: string
  status: FiscalDocStatus
  saleRef: string
  issuedAt: string
  protocol?: string
  buyerDocument?: string
  buyerEmail?: string
  items: CartItem[]
  payments: FiscalPaymentLine[]
  /** XML autorizado (mock / caminho futuro). */
  xml?: string
  /** Último envio da NF-e ao destinatário. */
  sentAt?: string
  sentTo?: string
  error?: string | null
}

export type FiscalEmitResult = {
  document: FiscalDocument
  message: string
}

export type FiscalSendRequest = {
  /** id ou chave de acesso */
  documentId: string
  email?: string
  /** Inclui XML no “envio” mock. */
  includeXml?: boolean
}

export type FiscalSendResult = {
  ok: boolean
  documentId: string
  sentTo: string
  sentAt: string
  message: string
}

export type FiscalPrintModel = 'simplified' | 'non_fiscal'

export type FiscalPrintRequest = {
  /** id ou chave de acesso */
  documentId: string
  /**
   * Se omitido: NFC-e → non_fiscal (cupom completo),
   * NF-e → simplified (DANFE simplificado).
   */
  model?: FiscalPrintModel
  /**
   * true = abre prévia HTML no PDV (sem diálogo do Windows se directPrint).
   * false = só imprime (direto na térmica quando directPrint=true).
   */
  openDialog?: boolean
  /** Força impressão RAW na ponte (sobrescreve config.directPrint). */
  direct?: boolean
}

export type FiscalPrintResult = {
  ok: boolean
  documentId: string
  model: FiscalPrintModel
  /** Texto térmico do cupom / DANFE. */
  text: string
  /** HTML para prévia / impressão. */
  html: string
  message: string
  /** true quando enviou RAW/ESC/POS à impressora. */
  direct?: boolean
  printerName?: string
  bytes?: number
}

export type FiscalListFilter = {
  tipo?: FiscalDocTipo | 'Todos'
  q?: string
  status?: FiscalDocStatus
}

export type FiscalFinalizeOptions = {
  /** Envia NF-e após autorização (padrão: config.autoSendNfe). */
  sendNfe?: boolean
  /** Imprime após emissão (NFC-e não-fiscal / NF-e simplificado). */
  print?: boolean
  /** E-mail destino do envio NF-e (senão buyer.email). */
  email?: string
}

export type FiscalFinalizeResult = {
  document: FiscalDocument
  send?: FiscalSendResult
  print?: FiscalPrintResult
}

export type FiscalCancelRequest = {
  documentId: string
  motivo: string
  /** Protocolo SEFAZ do evento (opcional até integração live). */
  protocoloCancelamento?: string
}

export type FiscalCancelResult = {
  ok: boolean
  document: FiscalDocument
  message: string
}
