import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  abrirNovoCaixa,
  getUltimoCaixa,
  isCaixaAberto,
  type CaixaRow,
} from '../services/caixa/caixaDb'

type CaixaStatus = 'loading' | 'aberto' | 'fechado' | 'erro'

type CaixaStatusContextValue = {
  status: CaixaStatus
  caixa: CaixaRow | null
  aberto: boolean
  error: string
  refresh: () => Promise<void>
  abrirCaixa: () => Promise<void>
  abrindo: boolean
}

const CaixaStatusContext = createContext<CaixaStatusContextValue | null>(null)

const REFRESH_MS = 20_000

export function CaixaStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CaixaStatus>('loading')
  const [caixa, setCaixa] = useState<CaixaRow | null>(null)
  const [error, setError] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const ultimo = await getUltimoCaixa()
      setCaixa(ultimo)
      setError('')
      setStatus(isCaixaAberto(ultimo) ? 'aberto' : 'fechado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar caixa.')
      setStatus('erro')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, REFRESH_MS)

    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])

  const abrirCaixa = useCallback(async () => {
    setAbrindo(true)
    setError('')
    try {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      const meta = user?.user_metadata ?? {}
      const operador =
        String(meta.name || meta.full_name || '').trim() ||
        user?.email?.split('@')[0] ||
        'operador'
      const filial = meta.filial_codigo
        ? String(meta.filial_codigo)
        : meta.filial
          ? String(meta.filial)
          : null

      const novo = await abrirNovoCaixa({
        operador,
        turno: '1',
        filial,
        pdv: meta.pdv ? String(meta.pdv) : undefined,
      })
      setCaixa(novo)
      setStatus('aberto')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir caixa.')
      setStatus('fechado')
      throw err
    } finally {
      setAbrindo(false)
    }
  }, [])

  const value = useMemo<CaixaStatusContextValue>(
    () => ({
      status,
      caixa,
      aberto: status === 'aberto',
      error,
      refresh,
      abrirCaixa,
      abrindo,
    }),
    [status, caixa, error, refresh, abrirCaixa, abrindo],
  )

  return (
    <CaixaStatusContext.Provider value={value}>
      {children}
    </CaixaStatusContext.Provider>
  )
}

export function useCaixaStatus() {
  const ctx = useContext(CaixaStatusContext)
  if (!ctx) {
    throw new Error('useCaixaStatus deve ser usado dentro de CaixaStatusProvider')
  }
  return ctx
}
