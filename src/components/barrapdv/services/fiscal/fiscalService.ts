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
  type TransmitItem,
} from '@/lib/nfe/transmissao'
import { normalizeAmbienteFiscal } from '@/lib/filialAmbienteFiscal'
import { tipoEmpresaToCrt } from '@/lib/filialTipoEmpresa'
import { getOperadorFilialId } from '../produtos/buscarProduto'
import { reservarNumeroFiscalTef } from '../tef/configuracaoTefDb'
import { supabase } from '@/lib/supabase'
import {
  aplicarImpostoNoItem,
  carregarImpostosProdutos,
} from './impostosProduto'

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
   *
   * mode=mock → autoriza localmente (sem SEFAZ)
   * mode=live → POST /api/fiscal/transmitir (certificado A1 da filial)
   */
  async emit(request: FiscalEmitRequest): Promise<FiscalEmitResult> {
    const tipo = request.tipo || decidirTipoDocumento(request.buyer?.document)

    let ambiente: 1 | 2 = 2
    let filialId: string | null = null
    let emitente = {
      cnpj: FISCAL_CONFIG.emitter.cnpj,
      ie: FISCAL_CONFIG.emitter.ie as string | null,
      razaoSocial: FISCAL_CONFIG.emitter.razaoSocial as string | null,
      fantasia: FISCAL_CONFIG.emitter.nomeFantasia as string | null,
      uf: FISCAL_CONFIG.emitter.uf as string | null,
      municipioIbge: null as string | null,
      cidade: FISCAL_CONFIG.emitter.cidade as string | null,
      endereco: FISCAL_CONFIG.emitter.endereco as string | null,
      numero: null as string | null,
      bairro: FISCAL_CONFIG.emitter.bairro as string | null,
      cep: FISCAL_CONFIG.emitter.cep as string | null,
      telefone: FISCAL_CONFIG.emitter.telefone as string | null,
      tokenId: null as string | null,
      tokenNfce: null as string | null,
      crt: 1 as 1 | 2 | 3,
    }

    try {
      filialId = await getOperadorFilialId()
      if (filialId) {
        const col = tipo === 'NFC-e' ? 'ambiente_nfce' : 'ambiente_nfe'
        const { data } = await supabase
          .from('filial')
          .select(
            `${col}, token_id, token_nfce, tipo_empresa, cnpj, razao_social, fantasia, inscricao_estadual, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, cep, telefone`,
          )
          .eq('id', filialId)
          .maybeSingle()
        const row = data as Record<string, unknown> | null
        if (row) {
          ambiente = normalizeAmbienteFiscal(row[col])
          const municipioIbge = (() => {
            const dig = String(row.endereco_cidade ?? '').replace(/\D/g, '')
            return dig.length === 7 ? dig : null
          })()
          let cidadeNome: string | null = null
          if (municipioIbge) {
            const { data: cidadeRow } = await supabase
              .from('cidades')
              .select('descricao')
              .eq('codigo', municipioIbge)
              .maybeSingle()
            if (cidadeRow?.descricao != null) {
              cidadeNome = String(cidadeRow.descricao).trim() || null
            }
          }
          emitente = {
            cnpj: row.cnpj != null ? String(row.cnpj) : emitente.cnpj,
            ie:
              row.inscricao_estadual != null
                ? String(row.inscricao_estadual)
                : emitente.ie,
            razaoSocial:
              row.razao_social != null
                ? String(row.razao_social)
                : emitente.razaoSocial,
            fantasia:
              row.fantasia != null ? String(row.fantasia) : emitente.fantasia,
            uf:
              row.endereco_uf != null ? String(row.endereco_uf) : emitente.uf,
            municipioIbge,
            cidade: cidadeNome,
            endereco:
              row.endereco != null ? String(row.endereco) : emitente.endereco,
            numero:
              row.endereco_numero != null ? String(row.endereco_numero) : null,
            bairro:
              row.endereco_bairro != null
                ? String(row.endereco_bairro)
                : emitente.bairro,
            cep: row.cep != null ? String(row.cep) : emitente.cep,
            telefone:
              row.telefone != null ? String(row.telefone) : emitente.telefone,
            tokenId:
              row.token_id != null && String(row.token_id).trim()
                ? String(row.token_id).replace(/\D/g, '').slice(0, 6)
                : null,
            tokenNfce:
              row.token_nfce != null && String(row.token_nfce).trim()
                ? String(row.token_nfce).trim().slice(0, 60)
                : null,
            crt: tipoEmpresaToCrt(
              row.tipo_empresa != null ? String(row.tipo_empresa) : null,
            ),
          }
        }
      }
    } catch {
      /* mantém defaults / homologação */
    }

    const numeracao = await reservarNumeroFiscalTef(tipo)

    let document: FiscalDocument
    let message: string
    let receitas: ReceitaFiscalLinha[] | undefined

    let itemsTx: TransmitItem[] = request.items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      price: i.price,
      unit: i.unit,
      kind: i.kind,
      productCode: i.productCode,
      discount: i.discount,
      pumpId: i.pumpId,
    }))

    try {
      const impostos = await carregarImpostosProdutos(
        itemsTx.map((i) => String(i.id || '')).filter(Boolean),
      )
      itemsTx = itemsTx.map((item) =>
        aplicarImpostoNoItem(item, impostos.get(String(item.id || ''))),
      )
    } catch (err) {
      console.warn(
        '[fiscal] impostos do produto:',
        err instanceof Error ? err.message : err,
      )
    }

    const payloadBase = {
      tipo,
      items: itemsTx,
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
      numero: numeracao.numero,
      ambiente,
      serie: String(numeracao.serie),
      filialId,
      emitente,
    }

    if (FISCAL_CONFIG.mode === 'live') {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error(
          'Sessão expirada. Faça login novamente para emitir na SEFAZ.',
        )
      }

      const res = await fetch('/api/fiscal/transmitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadBase),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        document?: FiscalDocument
        message?: string
        receitas?: ReceitaFiscalLinha[]
      }
      if (!res.ok) {
        // Mesmo rejeitada, grava XML assinado no disco para análise
        if (FISCAL_CONFIG.saveXmlLocal && body.document?.xml) {
          try {
            const saved = await this.saveXmlLocal({
              ...body.document,
              tipo: body.document.tipo || tipo,
              numero: body.document.numero || String(numeracao.numero),
              chave: body.document.chave || '',
            })
            if (saved?.path) {
              console.warn('[fiscal] XML rejeitado gravado em', saved.path)
            }
          } catch (saveErr) {
            console.warn(
              '[fiscal] XML rejeitado não gravou:',
              saveErr instanceof Error ? saveErr.message : saveErr,
            )
          }
        }
        throw new Error(body.error || `Falha ao emitir na SEFAZ (${res.status})`)
      }
      if (!body.document) {
        throw new Error('Resposta SEFAZ sem documento.')
      }
      document = {
        ...body.document,
        tokenId: emitente.tokenId || body.document.tokenId,
        tokenNfce: emitente.tokenNfce || body.document.tokenNfce,
      }
      message = body.message || 'NFC-e autorizada pela SEFAZ.'
      receitas = body.receitas
    } else {
      const tx = await transmitirDocumentoFiscal(payloadBase)

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
        tokenId: emitente.tokenId || undefined,
        tokenNfce: emitente.tokenNfce || undefined,
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

    if (FISCAL_CONFIG.saveXmlLocal && document.xml) {
      try {
        const saved = await this.saveXmlLocal(document)
        if (saved?.path) {
          message = `${message} XML local: ${saved.path}`
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'falha ao gravar XML'
        console.warn('[fiscal] XML local:', detail)
        message = `${message} (aviso: XML não gravou no disco — ${detail})`
      }
    }

    return { document, message }
  }

  /**
   * Grava o XML autorizado no PC via ponte fiscal (:39102).
   * Pasta padrão: `<cwd>/xml-fiscal/NFC-e|NF-e/` (override: FISCAL_XML_DIR).
   */
  async saveXmlLocal(
    doc: Pick<FiscalDocument, 'xml' | 'chave' | 'tipo' | 'numero'>,
  ): Promise<{ ok: boolean; path?: string; message?: string } | null> {
    if (!doc.xml?.trim()) return null
    const res = await fetch(`${this.bridgeUrl}/fiscal/save-xml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xml: doc.xml,
        chave: doc.chave,
        tipo: doc.tipo,
        numero: doc.numero,
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      path?: string
      message?: string
      error?: string
    }
    if (!res.ok) {
      throw new Error(body.error || `Falha ao gravar XML local (${res.status})`)
    }
    return {
      ok: body.ok !== false,
      path: body.path,
      message: body.message,
    }
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
