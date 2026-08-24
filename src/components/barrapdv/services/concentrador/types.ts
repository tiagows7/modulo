/** Registro da tabela temporária de abastecimentos (Companytec CBC → PDV) */
export type TempFillingStatus = 'disponivel' | 'abastecendo' | 'lancado'

export type TempFilling = {
  id: string
  /** id na tabela public.abastecimentos (quando persistido) */
  dbId?: number | null
  /** Número do bico no concentrador */
  nozzle: number
  /** Código interno do combustível no PDV */
  fuelId: string
  /** Código do produto no concentrador CBC */
  cbcProductCode: string
  quantity: number
  unitPrice: number
  total: number
  date: string
  time: string
  operator: string
  status: TempFillingStatus
  /**
   * Situação na tabela temporária:
   * 0 = aberto (ainda no grid)
   * 1 = usado / baixado (lançado no cupom ou baixado sem nota)
   */
  situacao: 0 | 1
  /** Identificador do abastecimento no CBC (para baixa/confirmação) */
  cbcSupplyId: string
  /** Origem do registro */
  source: 'companytec-cbc' | 'manual'
  receivedAt: string
  /** Medição/encerrante final do bico (concentrador) */
  medicao?: number | null
  caixaCodigo?: number | null
  caixaData?: string | null
  caixaTurno?: string | null
  caixaOperador?: string | null
  documento?: string | null
  cupom?: string | null
}

/** Resposta bruta parseada de um abastecimento CBC */
export type CbcSupplyPayload = {
  supplyId: string
  nozzle: number
  productCode: string
  liters: number
  unitPrice: number
  total: number
  status: 'disponivel' | 'abastecendo'
  bicoCode?: string
  date?: string
  time?: string
  medicao?: number | null
}

export type CbcConnectionMode = 'mock' | 'tcp'

export type CbcConfig = {
  mode: CbcConnectionMode
  host: string
  port: number
  /** Intervalo de varredura em ms */
  pollIntervalMs: number
  /** Operador atual do PDV (até haver sessão real) */
  defaultOperator: string
}

export type CbcNozzleStatusCode =
  | 'livre'
  | 'pronta'
  | 'falha'
  | 'concluiu'
  | 'abastecendo'
  | 'bloqueada'
  | 'solicita'
  | 'desconhecido'

export type CbcNozzleStatus = {
  /** Índice/ordem no (&S) ou valor numérico do código hex */
  nozzle: number
  /** Código de bico do CBC (hex, ex.: "04") — vem do (&V) quando abastecendo */
  bicoCode: string
  code: string
  status: CbcNozzleStatusCode
}

export type CbcConnectionState = {
  connected: boolean
  mode: CbcConnectionMode
  lastPollAt: string | null
  lastError: string | null
  message: string
  nozzles: CbcNozzleStatus[]
}
