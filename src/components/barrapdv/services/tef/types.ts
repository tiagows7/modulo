/** Modalidades CliSiTef (AppSiTef / Software Express). */
export type TefMethod = 'tef' | 'pix'

export type TefTransactionStatus =
  | 'idle'
  | 'starting'
  | 'waiting_card'
  | 'waiting_pin'
  | 'waiting_pix'
  | 'waiting_menu'
  | 'waiting_field'
  | 'waiting_confirm'
  | 'waiting_key'
  | 'processing'
  | 'approved'
  | 'denied'
  | 'cancelled'
  | 'error'

export type TefMenuOption = {
  code: string
  label: string
}

export type TefFieldPrompt = {
  prompt: string
  minLength: number
  maxLength: number
  /** text | number | currency */
  inputMode: 'text' | 'number' | 'currency'
  tipoCampo: number
}

export type TefStartRequest = {
  method: TefMethod
  amount: number
  cupom: string
  operator?: string
}

export type TefTransactionState = {
  transactionId: string
  method: TefMethod
  amount: number
  status: TefTransactionStatus
  message: string
  /** Payload EMV / copia-e-cola do QR PIX (quando houver) */
  pixQrPayload?: string | null
  nsu?: string | null
  authorizationCode?: string | null
  brand?: string | null
  receiptCustomer?: string | null
  receiptMerchant?: string | null
  error?: string | null
  /** Menu CliSiTef (comando 21) — operador escolhe no PDV. */
  menuTitle?: string | null
  menuOptions?: TefMenuOption[] | null
  /** Coleta de campo (parcelas, etc.). */
  fieldPrompt?: TefFieldPrompt | null
  updatedAt: string
}

export const TEF_METHOD_FUNCTION: Record<TefMethod, number> = {
  /** Função 0 = menu completo de vendas (exemplo oficial). */
  tef: 0,
  /** Carteiras digitais / PIX (CliSiTef) */
  pix: 122,
}