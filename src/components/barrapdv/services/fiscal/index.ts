export { FISCAL_CONFIG } from './config'
export { fiscalService } from './fiscalService'
export {
  buildSimplifiedDanfeHtml,
  buildSimplifiedDanfeText,
  openSimplifiedPreview,
  openSimplifiedPrintDialog,
  registerDocumentPreviewOpener,
} from './printSimplified'
export {
  buildNfceNonFiscalHtml,
  buildNfceNonFiscalText,
  buildNfceQrPayload,
} from './printNfceNonFiscal'
export { printHtmlDocument } from './printHtml'
export type {
  FiscalBuyer,
  FiscalCancelRequest,
  FiscalCancelResult,
  FiscalDocStatus,
  FiscalDocTipo,
  FiscalDocument,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalFinalizeOptions,
  FiscalFinalizeResult,
  FiscalListFilter,
  FiscalPaymentLine,
  FiscalPrintModel,
  FiscalPrintRequest,
  FiscalPrintResult,
  FiscalSendRequest,
  FiscalSendResult,
} from './types'
