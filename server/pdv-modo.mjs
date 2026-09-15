/**
 * Modo do PDV persistido no PC do caixa (posto | loja).
 * Usado pelas pontes locais para, no modo loja, não subir o CBC.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODO_FILE = path.join(root, 'server', '.pdv-modo.json')

/**
 * @returns {'posto' | 'loja'}
 */
export function readPdvModo() {
  const fromEnv = String(process.env.PDV_MODO || '')
    .trim()
    .toLowerCase()
  if (fromEnv === 'loja' || fromEnv === 'posto') return fromEnv

  try {
    if (!fs.existsSync(MODO_FILE)) return 'posto'
    const raw = JSON.parse(fs.readFileSync(MODO_FILE, 'utf8'))
    const modo = String(raw?.modo || '').trim().toLowerCase()
    if (modo === 'loja' || modo === 'posto') return modo
  } catch {
    /* ignore */
  }
  return 'posto'
}

/**
 * @param {'posto' | 'loja'} modo
 */
export function writePdvModo(modo) {
  const value = modo === 'loja' ? 'loja' : 'posto'
  fs.writeFileSync(
    MODO_FILE,
    `${JSON.stringify({ modo: value, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
  return value
}

export function isModoLoja() {
  return readPdvModo() === 'loja'
}

export { MODO_FILE }
