type AlertModalProps = {
  open: boolean
  title: string
  message: string
  buttonLabel?: string
  /** Se informado, mostra Sim / Não em vez de um único botão. */
  confirm?: {
    yesLabel?: string
    noLabel?: string
    onYes: () => void
    onNo: () => void
  }
  onClose: () => void
}

/** Modal padrão de aviso do PDV (mesmo modelo do “Ir para pagamento”). */
export function AlertModal({
  open,
  title,
  message,
  buttonLabel = 'Entendi',
  confirm,
  onClose,
}: AlertModalProps) {
  if (!open) return null

  return (
    <div
      className="modal-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pdv-alert-title"
      aria-describedby="pdv-alert-message"
    >
      <div className="modal-card">
        <div className="modal-icon">!</div>
        <h2 id="pdv-alert-title">{title}</h2>
        <p id="pdv-alert-message">{message}</p>
        {confirm ? (
          <div className="modal-confirm-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={confirm.onYes}
              autoFocus
            >
              {confirm.yesLabel ?? 'Sim'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={confirm.onNo}
            >
              {confirm.noLabel ?? 'Não'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onClose}
            autoFocus
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
