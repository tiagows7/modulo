import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertModal } from '../components/AlertModal'

export type AlertOptions = {
  title: string
  message: string
  buttonLabel?: string
}

export type ConfirmOptions = {
  title: string
  message: string
  yesLabel?: string
  noLabel?: string
}

type AlertContextValue = {
  showAlert: (options: AlertOptions) => void
  /** Pergunta Sim/Não. Resolve true se Sim, false se Não. */
  showConfirm: (options: ConfirmOptions) => Promise<boolean>
}

type DialogState =
  | { kind: 'alert'; options: AlertOptions }
  | {
      kind: 'confirm'
      options: ConfirmOptions
      resolve: (value: boolean) => void
    }
  | null

const AlertContext = createContext<AlertContextValue | null>(null)

export function AlertProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const dialogRef = useRef<DialogState>(null)
  useEffect(() => {
    dialogRef.current = dialog
  }, [dialog])

  const showAlert = useCallback((options: AlertOptions) => {
    setDialog({ kind: 'alert', options })
  }, [])

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ kind: 'confirm', options, resolve })
    })
  }, [])

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm])

  function closeAlert() {
    setDialog(null)
  }

  function answerConfirm(yes: boolean) {
    const current = dialogRef.current
    if (current?.kind === 'confirm') {
      current.resolve(yes)
    }
    setDialog(null)
  }

  return (
    <AlertContext.Provider value={value}>
      {children}
      {createPortal(
        <AlertModal
          open={dialog != null}
          title={dialog?.options.title ?? ''}
          message={dialog?.options.message ?? ''}
          buttonLabel={dialog?.kind === 'alert' ? dialog.options.buttonLabel : undefined}
          confirm={
            dialog?.kind === 'confirm'
              ? {
                  yesLabel: dialog.options.yesLabel,
                  noLabel: dialog.options.noLabel,
                  onYes: () => answerConfirm(true),
                  onNo: () => answerConfirm(false),
                }
              : undefined
          }
          onClose={closeAlert}
        />,
        document.body,
      )}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) {
    throw new Error('useAlert deve ser usado dentro de AlertProvider')
  }
  return ctx
}
