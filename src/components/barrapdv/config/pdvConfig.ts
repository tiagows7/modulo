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
let syncTimer: ReturnType<typeof setTimeout> | null = null

/** Grava o modo no PC local para o posto.mjs não subir o CBC em modo loja. */
function syncModoLocal(modo: PdvModo) {
  if (typeof window === 'undefined') return
  const urls = [
    '/__local/pdv-modo',
    'http://127.0.0.1:39199/__local/pdv-modo',
  ]
  void Promise.allSettled(
    urls.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo }),
      }).catch(() => null),
    ),
  )
}

function scheduleSyncModoLocal(modo: PdvModo) {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncModoLocal(modo)
  }, 80)
}

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
  scheduleSyncModoLocal(modo)
  listeners.forEach((fn) => fn(modo))
}

export function subscribePdvModo(listener: (modo: PdvModo) => void) {
  listeners.add(listener)
  listener(currentModo)
  return () => {
    listeners.delete(listener)
  }
}

/** Sincroniza o modo atual com o proxy local (útil ao abrir o PDV). */
export function syncPdvModoLocal() {
  scheduleSyncModoLocal(currentModo)
}

export const PDV_MODO_LABEL: Record<PdvModo, string> = {
  posto: 'Posto (combustível)',
  loja: 'Loja de conveniência',
}
