import { FISCAL_CONFIG } from './config'
import { mockFiscalEngine } from './mockEngine'
import {
  buildNfceNonFiscalHtml,
  buildNfceNonFiscalText,
  buildNfceQrPayload,
} from './printNfceNonFiscal'
import {
  buildSimplifiedDanfeHtml,
  buildSimplifiedDanfeText,
  openSimplifiedPreview,
} from './printSimplified'
import type {
  FiscalBuyer,
  FiscalCancelRequest,
  FiscalCancelResult,
  FiscalDocTipo,
  FiscalDocument,
  FiscalEmitRequest,
  FiscalEmitResult,
  FiscalFinalizeOptions,
  FiscalFinalizeResult,
  FiscalListFilter,
  FiscalPrintModel,
  FiscalPrintRequest,
  FiscalPrintResult,
  FiscalSendRequest,
  FiscalSendResult,
} from './types'
import {
  cancelVendaFiscalDocument,
  getVendaFiscalDocument,
  listVendaFiscalDocuments,
  saveVendaFiscalDocument,
} from './vendaFiscalDb'
import {
  decidirTipoDocumento,
  transmitirDocumentoFiscal,
  type ReceitaFiscalLinha,
} from '@/lib/nfe/transmissao'
import { normalizeAmbienteFiscal } from '@/lib/filialAmbienteFiscal'
import { getOperadorFilialId } from '../produtos/buscarProduto'
import { supabase } from '@/lib/supabase'

function resolvePrintModel(
  doc: FiscalDocument,
  requested?: FiscalPrintModel,
): FiscalPrintModel {
  if (requested) return requested
  return doc.tipo === 'NFC-e' ? 'non_fiscal' : 'simplified'
}

async function buildPrintArtifacts(doc: FiscalDocument, model: FiscalPrintModel) {
  // NFC-e sempre cupom completo não-fiscal (mesmo se pedirem simplified por engano).
  if (doc.tipo === 'NFC-e' || model === 'non_fiscal') {
    return {
      model: 'non_fiscal' as const,
      text: buildNfceNonFiscalText(doc),
      html: await buildNfceNonFiscalHtml(doc),
      label: 'Cupom NFC-e (impressora não-fiscal)',
    }
  }
  return {
    model: 'simplified' as const,
    text: buildSimplifiedDanfeText(doc),
    html: buildSimplifiedDanfeHtml(doc, 'simplified'),
    label: 'DANFE NF-e (modelo simplificado)',
  }
}

/**
 * Rotina fiscal compartilhada (NFC-e / NF-e).
 *
 * Use este serviço em Pagamento, Reimpressão, Cancelamento, etc.
 * Evita duplicar emissão, envio e impressão nas páginas.
 *
 * @example
 * const result = await fiscalService.emitAndFinalize({
 *   items: cart,
 *   buyer: customer,
 *   payments: payLines,
 *   saleRef: 'PDV000123',
 * })
 * // result.document · result.send? · result.print?
 */
class FiscalService {
  get bridgeUrl() {
    return FISCAL_CONFIG.bridgeUrl.replace(/\/$/, '')
  }

  get mode() {
    return FISCAL_CONFIG.mode
  }

  /** Sugere NFC-e (consumidor) ou NF-e (CNPJ / IE). */
  suggestTipo(buyer?: FiscalBuyer): FiscalDocTipo {
    return decidirTipoDocumento(buyer?.document) as FiscalDocTipo
  }

  async health(): Promise<{ ok: boolean; mode: string; message: string }> {
    if (FISCAL_CONFIG.mode === 'mock') {
      return {
        ok: true,
        mode: 'mock',
        message: 'Motor fiscal mock local (sem SEFAZ).',
      }
    }
    try {
      const res = await fetch(`${this.bridgeUrl}/health`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { ok: boolean; mode: string; message: string }
    } catch (err) {
      return {
        ok: false,
        mode: 'live',
        message:
          err instanceof Error
            ? err.message
            : 'Ponte fiscal offline — rode npm run fiscal-bridge',
      }
    }
  }

  /**
   * Emite e autoriza NFC-e ou NF-e via `@modulo/nfe-transmissao`.
   * CPF / documento em branco → NFC-e; CNPJ → NF-e.
   * Grava venda_* + receitas_*.
   */
  async emit(request: FiscalEmitRequest): Promise<FiscalEmitResult> {
    const tipo = request.tipo || decidirTipoDocumento(request.buyer?.document)

    let ambiente: 1 | 2 = 2
    try {
      const filialId = await getOperadorFilialId()
      if (filialId) {
        const col = tipo === 'NFC-e' ? 'ambiente_nfce' : 'ambiente_nfe'
        const { data } = await supabase
          .from('filial')
          .select(col)
          .eq('id', filialId)
          .maybeSingle()
        const raw = data ? (data as Record<string, unknown>)[col] : null
        ambiente = normalizeAmbienteFiscal(raw)
      }
    } catch {
      /* mantém homologação */
    }

    let document: FiscalDocument
    let message: string
    let receitas: ReceitaFiscalLinha[] | undefined

    if (FISCAL_CONFIG.mode === 'live') {
      const res = await fetch(`${this.bridgeUrl}/fiscal/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, tipo, ambiente }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Falha ao emitir (${res.status})`)
      }
      const result = (await res.json()) as FiscalEmitResult
      document = result.document
      message = result.message
    } else {
      const tx = await transmitirDocumentoFiscal({
        tipo,
        items: request.items.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.qty,
          price: i.price,
          unit: i.unit,
          kind: i.kind,
          productCode: i.productCode,
          discount: i.discount,
          pumpId: i.pumpId,
        })),
        payments: request.payments.map((p) => ({
          methodId: p.methodId,
          label: p.label,
          amount: p.amount,
          isTef: p.isTef,
          nsu: p.nsu,
          authorizationCode: p.authorizationCode,
          brand: p.brand,
          tef: p.tef,
        })),
        buyer: request.buyer,
        saleRef: request.saleRef,
        operator: request.operator,
        total: request.total,
        ambiente,
        serie: FISCAL_CONFIG.series[tipo],
        emitente: {
          cnpj: FISCAL_CONFIG.emitter.cnpj,
          ie: FISCAL_CONFIG.emitter.ie,
          razaoSocial: FISCAL_CONFIG.emitter.razaoSocial,
          fantasia: FISCAL_CONFIG.emitter.nomeFantasia,
          uf: FISCAL_CONFIG.emitter.uf,
        },
      })

      receitas = tx.receitas
      const d = tx.document
      document = {
        id: d.id,
        tipo: d.tipo,
        numero: String(d.numero).padStart(6, '0'),
        serie: d.serie,
        chave: d.chave,
        emissao: d.emissao,
        hora: d.hora,
        valor: d.valor,
        cliente: d.cliente,
        status: d.status,
        saleRef: d.saleRef,
        issuedAt: d.issuedAt,
        protocol: d.protocolo,
        buyerDocument: d.buyerDocument,
        buyerEmail: d.buyerEmail,
        items: request.items.map((i) => ({ ...i })),
        payments: request.payments.map((p) => ({ ...p })),
        xml: d.xml,
        error: d.error ?? null,
      }
      message = tx.message
    }

    try {
      document = await saveVendaFiscalDocument(document, {
        receitas,
        ambiente,
      })
      message = `${document.tipo} ${document.numero} autorizada e gravada (venda + receitas).`
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'falha ao gravar'
      console.warn('[fiscal] persistência venda/receitas:', detail)
      message = `${message} (aviso: não gravou no banco — ${detail})`
    }

    return { document, message }
  }

  /**
   * Envia NF-e ao destinatário (e-mail / XML).
   * NFC-e: retorna erro amigável — use apenas para NF-e.
   */
  async sendNfe(request: FiscalSendRequest): Promise<FiscalSendResult> {
    if (FISCAL_CONFIG.mode === 'live') {
      const res = await fetch(`${this.bridgeUrl}/fiscal/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Falha ao enviar NF-e (${res.status})`)
      }
      return (await res.json()) as FiscalSendResult
    }

    const doc = mockFiscalEngine.get(request.documentId) || (await getVendaFiscalDocument(request.documentId))
    if (!doc) throw new Error('Documento não encontrado para envio.')
    if (doc.tipo !== 'NF-e') {
      throw new Error('Envio ao destinatário aplica-se apenas à NF-e.')
    }

    const sentTo =
      request.email?.trim() ||
      doc.buyerEmail?.trim() ||
      'destinatario@empresa.local'

    const updated = mockFiscalEngine.markSent(doc, sentTo)
    return {
      ok: true,
      documentId: updated.id,
      sentTo,
      sentAt: updated.sentAt!,
      message: `NF-e ${updated.numero} enviada para ${sentTo} (mock${request.includeXml === false ? '' : ' + XML'}).`,
    }
  }

  /**
   * Prévia / impressão:
   * - NFC-e → cupom completo (impressora não-fiscal)
   * - NF-e → DANFE modelo simplificado
   * - directPrint → ESC/POS RAW na ponte (sem diálogo Windows)
   */
  async print(request: FiscalPrintRequest): Promise<FiscalPrintResult> {
    const openDialog = request.openDialog === true
    const direct =
      request.direct === true ||
      (request.direct !== false && FISCAL_CONFIG.directPrint)

    const doc = await this.get(request.documentId)

    if (!doc) throw new Error('Documento não encontrado para impressão.')

    const built = await buildPrintArtifacts(doc, resolvePrintModel(doc, request.model))
    const qrPayload = doc.tipo === 'NFC-e' ? buildNfceQrPayload(doc) : undefined

    if (direct) {
      try {
        const res = await fetch(`${this.bridgeUrl}/fiscal/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: doc.id,
            model: built.model,
            text: built.text,
            html: built.html,
            qrPayload,
            printerName: FISCAL_CONFIG.printerName || undefined,
            direct: true,
            openDialog: false,
            cut: true,
            docName: `${doc.tipo} ${doc.numero}`,
          }),
        })
        const body = (await res.json().catch(() => ({}))) as FiscalPrintResult & {
          error?: string
        }
        if (!res.ok) {
          throw new Error(body.error || `Falha ao imprimir (${res.status})`)
        }

        if (openDialog) {
          openSimplifiedPreview(built.html, { autoPrint: false })
        }

        return {
          ok: true,
          documentId: doc.id,
          model: built.model,
          text: built.text,
          html: built.html,
          direct: true,
          printerName: body.printerName,
          bytes: body.bytes,
          message:
            body.message ||
            `${built.label} nº ${doc.numero} enviado para a impressora.`,
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Falha na impressão direta.'
        const hint =
          /fetch|Failed|NetworkError|ECONNREFUSED/i.test(message)
            ? ' Verifique se a ponte fiscal está rodando (npm run fiscal-bridge).'
            : ''
        return {
          ok: false,
          documentId: doc.id,
          model: built.model,
          text: built.text,
          html: built.html,
          direct: true,
          message: `${message}${hint}`,
        }
      }
    }

    // Fallback: prévia HTML (dialog Windows só se o operador clicar Imprimir no modal).
    if (openDialog || request.openDialog !== false) {
      const opened = openSimplifiedPreview(built.html, { autoPrint: false })
      return {
        ok: opened,
        documentId: doc.id,
        model: built.model,
        text: built.text,
        html: built.html,
        message: opened
          ? `${built.label} nº ${doc.numero} aberto para visualização.`
          : 'Não foi possível abrir a prévia do cupom.',
      }
    }

    return {
      ok: true,
      documentId: doc.id,
      model: built.model,
      text: built.text,
      html: built.html,
      message: `${built.label} nº ${doc.numero} gerado (sem impressão).`,
    }
  }

  /** Alias semântico para reimpressão (mesma rotina de print). */
  async reprint(request: FiscalPrintRequest): Promise<FiscalPrintResult> {
    return this.print(request)
  }

  /**
   * Lista NFC-e / NF-e a partir de `venda_nfce` e `venda_nfe`.
   * Se o banco estiver vazio/indisponível em mock, cai no motor local.
   */
  async list(filter: FiscalListFilter = {}): Promise<FiscalDocument[]> {
    try {
      return await listVendaFiscalDocuments(filter)
    } catch (err) {
      if (FISCAL_CONFIG.mode === 'live') throw err
      console.warn('[fiscal] list banco falhou, usando mock:', err)
      return mockFiscalEngine.list(filter)
    }
  }

  async get(idOrChave: string): Promise<FiscalDocument | null> {
    try {
      const fromDb = await getVendaFiscalDocument(idOrChave)
      if (fromDb) return fromDb
    } catch (err) {
      if (FISCAL_CONFIG.mode === 'live') throw err
      console.warn('[fiscal] get banco falhou, tentando mock:', err)
    }

    if (FISCAL_CONFIG.mode === 'live') {
      const res = await fetch(
        `${this.bridgeUrl}/fiscal/documents/${encodeURIComponent(idOrChave)}`,
      )
      if (res.status === 404) return null
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Falha ao obter documento (${res.status})`)
      }
      return (await res.json()) as FiscalDocument
    }

    return mockFiscalEngine.get(idOrChave)
  }

  /**
   * Cancela NFC-e / NF-e no banco (`situacao=cancelada` + protocolo/motivo).
   * Evento SEFAZ real fica para a ponte live.
   */
  async cancel(request: FiscalCancelRequest): Promise<FiscalCancelResult> {
    const document = await cancelVendaFiscalDocument(request)
    return {
      ok: true,
      document,
      message: `${document.tipo} ${document.numero} cancelada no banco.`,
    }
  }

  /**
   * Fluxo completo de venda: emite → envia NF-e (se aplicável) → imprime
   * (NFC-e cupom não-fiscal / NF-e simplificado).
   */
  async emitAndFinalize(
    request: FiscalEmitRequest,
    options: FiscalFinalizeOptions = {},
  ): Promise<FiscalFinalizeResult> {
    const emitResult = await this.emit(request)
    let document = emitResult.document
    let send: FiscalSendResult | undefined
    let print: FiscalPrintResult | undefined

    const shouldSend =
      document.tipo === 'NF-e' &&
      (options.sendNfe ?? FISCAL_CONFIG.autoSendNfe)

    if (shouldSend) {
      send = await this.sendNfe({
        documentId: document.id,
        email: options.email || document.buyerEmail,
        includeXml: true,
      })
      document = (await this.get(document.id)) || document
    }

    const shouldPrint = options.print ?? FISCAL_CONFIG.autoPrint
    if (shouldPrint) {
      print = await this.print({
        documentId: document.id,
        openDialog: true,
      })
    }

    return { document, send, print }
  }
}

export const fiscalService = new FiscalService()
