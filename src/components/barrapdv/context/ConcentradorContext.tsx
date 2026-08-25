import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { companytecCbc } from '../services/concentrador/companytecCbc'
import { tempFillingTable } from '../services/concentrador/tempFillingTable'
import type { CbcConnectionState, TempFilling } from '../services/concentrador/types'
import type { Filling } from '../data/mock'
import { isModoLoja, subscribePdvModo } from '../config/pdvConfig'

type ConcentradorContextValue = {
  /** Abastecimentos em aberto (situacao = 0) para o grid */
  fillings: Filling[]
  tempRows: TempFilling[]
  connection: CbcConnectionState
  acknowledgeFilling: (id: string) => Promise<void>
  /** Baixa sem lançar no cupom / emitir nota (situacao = 1) */
  baixaSemNota: (id: string) => Promise<void>
  /** Reabre abastecimentos no grid (situacao = 0), ex.: limpar cupom */
  reabrirAbastecimentos: (ids: string[]) => void
}

const ConcentradorContext = createContext<ConcentradorContextValue | null>(null)

const LOJA_CONNECTION: CbcConnectionState = {
  connected: true,
  mode: 'mock',
  lastPollAt: null,
  lastError: null,
  message: 'Modo loja — concentrador CBC desligado',
  nozzles: [],
}

function toGridFilling(row: TempFilling): Filling {
  return {
    id: row.id,
    nozzle: row.nozzle,
    fuelId: row.fuelId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    total: row.total,
    date: row.date,
    time: row.time,
    operator: row.operator,
    status: row.status,
    situacao: row.situacao,
  }
}

export function ConcentradorProvider({ children }: { children: ReactNode }) {
  const [modoLoja, setModoLoja] = useState(() => isModoLoja())
  const [tempRows, setTempRows] = useState<TempFilling[]>(() =>
    modoLoja ? [] : tempFillingTable.list(),
  )
  const [connection, setConnection] = useState<CbcConnectionState>(() =>
    modoLoja ? LOJA_CONNECTION : companytecCbc.getState(),
  )

  useEffect(() => subscribePdvModo((modo) => setModoLoja(modo === 'loja')), [])

  useEffect(() => {
    if (modoLoja) {
      companytecCbc.stop()
      tempFillingTable.clear()
      setTempRows([])
      setConnection(LOJA_CONNECTION)
      return
    }

    const unsubTable = tempFillingTable.subscribe(setTempRows)
    const unsubState = companytecCbc.subscribeState(setConnection)
    companytecCbc.start()

    return () => {
      unsubTable()
      unsubState()
      companytecCbc.stop()
    }
  }, [modoLoja])

  const value = useMemo<ConcentradorContextValue>(
    () => ({
      tempRows,
      fillings: modoLoja
        ? []
        : tempRows
            .filter((r) => r.situacao === 0)
            .slice()
            .sort((a, b) => {
              const na = Number(a.cbcSupplyId) || 0
              const nb = Number(b.cbcSupplyId) || 0
              if (na !== nb) return na - nb
              return a.id.localeCompare(b.id)
            })
            .map(toGridFilling),
      connection: modoLoja ? LOJA_CONNECTION : connection,
      async acknowledgeFilling(id: string) {
        if (modoLoja) return
        await companytecCbc.acknowledgeSupply(id)
      },
      async baixaSemNota(id: string) {
        if (modoLoja) return
        await companytecCbc.baixaSemNota(id)
      },
      reabrirAbastecimentos(ids: string[]) {
        if (modoLoja) return
        void companytecCbc.reabrirSupplies(ids)
      },
    }),
    [tempRows, connection, modoLoja],
  )

  return (
    <ConcentradorContext.Provider value={value}>{children}</ConcentradorContext.Provider>
  )
}

export function useConcentrador() {
  const ctx = useContext(ConcentradorContext)
  if (!ctx) {
    throw new Error('useConcentrador deve ser usado dentro de ConcentradorProvider')
  }
  return ctx
}
