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
  const [tempRows, setTempRows] = useState<TempFilling[]>(() => tempFillingTable.list())
  const [connection, setConnection] = useState<CbcConnectionState>(() =>
    companytecCbc.getState(),
  )

  useEffect(() => {
    const unsubTable = tempFillingTable.subscribe(setTempRows)
    const unsubState = companytecCbc.subscribeState(setConnection)
    companytecCbc.start()

    return () => {
      unsubTable()
      unsubState()
      companytecCbc.stop()
    }
  }, [])

  const value = useMemo<ConcentradorContextValue>(
    () => ({
      tempRows,
      fillings: tempRows
        .filter((r) => r.situacao === 0)
        .map(toGridFilling),
      connection,
      async acknowledgeFilling(id: string) {
        await companytecCbc.acknowledgeSupply(id)
      },
      async baixaSemNota(id: string) {
        await companytecCbc.baixaSemNota(id)
      },
      reabrirAbastecimentos(ids: string[]) {
        void companytecCbc.reabrirSupplies(ids)
      },
    }),
    [tempRows, connection],
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
