/**
 * Modelo do PDV:
 * - posto  → combustível + concentrador CBC + abastecimentos
 * - loja   → conveniência (produtos), sem CBC/combustível
 */
export type PdvModo = 'posto' | 'loja'

const STORAGE_KEY = 'pdv_modo'

const listeners = new Set<(modo: PdvModo) => void>()

function readStored(): PdvModo {
  if (typeof window === 'undefined') return 'posto'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'loja' || v === 'posto') return v
  } catch {
    /* ignore */
  }
  return 'posto'
}

let currentModo: PdvModo = readStored()

export function getPdvModo(): PdvModo {
  return currentModo
}

export function isModoLoja(): boolean {
  return getPdvModo() === 'loja'
}

export function isModoPosto(): boolean {
  return getPdvModo() === 'posto'
}

export function setPdvModo(modo: PdvModo) {
  currentModo = modo
  try {
    localStorage.setItem(STORAGE_KEY, modo)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(modo))
}

export function subscribePdvModo(listener: (modo: PdvModo) => void) {
  listeners.add(listener)
  listener(currentModo)
  return () => listeners.delete(listener)
}

export const PDV_MODO_LABEL: Record<PdvModo, string> = {
  posto: 'Posto (combustível)',
  loja: 'Loja de conveniência',
}
