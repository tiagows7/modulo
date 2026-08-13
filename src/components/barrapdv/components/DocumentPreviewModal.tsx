import { createPortal } from 'react-dom'
import { FISCAL_CONFIG } from '../services/fiscal/config'
import { printHtmlDocument } from '../services/fiscal/printHtml'
import { useAlert } from '../context/AlertContext'

type DocumentPreviewModalProps = {
  open: boolean
  html: string | null
  /** Texto ESC/POS / cupom (quando impressão direta). */
  text?: string | null
  qrPayload?: string | null
  docName?: string | null
  onClose: () => void
}

/** Prévia de cupom/DANFE na própria página (sem window.open). */
export function DocumentPreviewModal({
  open,
  html,
  text,
  qrPayload,
  docName,
  onClose,
}: DocumentPreviewModalProps) {
  const { showAlert } = useAlert()

  if (!open || !html) return null

  const content = html

  async function handlePrint() {
    if (FISCAL_CONFIG.directPrint) {
      try {
        const res = await fetch(`${FISCAL_CONFIG.bridgeUrl}/fiscal/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text || content.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim(),
            html: content,
            qrPayload: qrPayload || undefined,
            printerName: FISCAL_CONFIG.printerName || undefined,
            direct: true,
            cut: true,
            docName: docName || 'PDV Cupom',
          }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          error?: string
          printerName?: string
        }
        if (!res.ok || body.ok === false) {
          throw new Error(body.error || body.message || `Falha ao imprimir (${res.status})`)
        }
        showAlert({
          title: 'Impressão',
          message: body.message || `Cupom enviado para ${body.printerName || 'a impressora'}.`,
        })
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha na impressão direta.'
        const hint = /fetch|Failed|NetworkError|ECONNREFUSED/i.test(message)
          ? '\n\nExecute: npm run fiscal-bridge'
          : ''
        showAlert({
          title: 'Impressão',
          message: `${message}${hint}`,
        })
        return
      }
    }

    const ok = await printHtmlDocument(content)
    if (!ok) {
      showAlert({
        title: 'Impressão',
        message:
          'Não foi possível iniciar a impressão. Verifique se há uma impressora instalada no Windows e tente novamente.',
      })
    }
  }

  return createPortal(
    <div
      className="doc-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Prévia do cupom"
    >
      <div className="doc-preview-card">
        <div className="doc-preview-toolbar">
          <button type="button" className="btn btn-primary" onClick={() => void handlePrint()}>
            Imprimir
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
        <iframe
          id="pdv-doc-preview-frame"
          className="doc-preview-frame"
          title="Prévia do cupom"
          srcDoc={html}
        />
      </div>
    </div>,
    document.body,
  )
}
