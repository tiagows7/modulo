"use client";

import { useEffect, useState } from 'react'
import {
  getPdvModo,
  setPdvModo,
  subscribePdvModo,
  type PdvModo,
  PDV_MODO_LABEL,
} from '../config/pdvConfig'

/** Hook reativo ao modo do PDV (posto | loja). */
export function usePdvModo() {
  const [modo, setModo] = useState<PdvModo>(() => getPdvModo())

  useEffect(() => subscribePdvModo(setModo), [])

  return {
    modo,
    isLoja: modo === 'loja',
    isPosto: modo === 'posto',
    setModo: setPdvModo,
    label: PDV_MODO_LABEL[modo],
  }
}
