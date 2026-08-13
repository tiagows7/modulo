import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DocumentPreviewModal } from '../components/DocumentPreviewModal'
import { printHtmlDocument } from '../services/fiscal/printHtml'
import { registerDocumentPreviewOpener } from '../services/fiscal/printSimplified'

type PreviewContextValue = {
  openPreview: (html: string) => void
  closePreview: () => void
}

const PreviewContext = createContext<PreviewContextValue | null>(null)

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [html, setHtml] = useState<string | null>(null)

  const openPreview = useCallback((nextHtml: string) => {
    setHtml(nextHtml)
  }, [])

  const closePreview = useCallback(() => {
    setHtml(null)
  }, [])

  useEffect(() => {
    const opener = (nextHtml: string) => {
      setHtml(nextHtml)
      return true
    }
    const unregister = registerDocumentPreviewOpener(opener)

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ html?: string; autoPrint?: boolean }>).detail
      if (detail?.html) {
        setHtml(detail.html)
        if (detail.autoPrint) {
          window.setTimeout(() => {
            void printHtmlDocument(detail.html!)
          }, 400)
        }
      }
    }
    window.addEventListener('pdv:open-doc-preview', onEvent)

    return () => {
      unregister()
      window.removeEventListener('pdv:open-doc-preview', onEvent)
    }
  }, [])

  const value = useMemo(
    () => ({ openPreview, closePreview }),
    [openPreview, closePreview],
  )

  return (
    <PreviewContext.Provider value={value}>
      {children}
      <DocumentPreviewModal open={html != null} html={html} onClose={closePreview} />
    </PreviewContext.Provider>
  )
}

export function useDocumentPreview() {
  const ctx = useContext(PreviewContext)
  if (!ctx) throw new Error('useDocumentPreview deve ser usado dentro de PreviewProvider')
  return ctx
}
