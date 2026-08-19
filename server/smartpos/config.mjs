/**
 * Config SmartPOS → Supabase (mesma lógica Delphi, sem Firebird).
 *
 * Env:
 *   SMARTPOS_SUPABASE_URL
 *   SMARTPOS_SUPABASE_KEY   (anon ou service_role)
 *   SMARTPOS_PORT
 *   (fallback) NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 *              SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function loadEnvFile(fileName) {
  const filePath = path.join(rootDir, fileName)
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

export const SMARTPOS_BRIDGE = {
  port: Number(process.env.SMARTPOS_PORT || 39103),
  mode: process.env.SMARTPOS_MODE || 'live',
  supabase: {
    url: (
      process.env.SMARTPOS_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://vwzpcvrrjohmudsczwhp.supabase.co'
    ).replace(/\/$/, ''),
    /**
     * Key do projeto (Settings → API).
     * Preferir service_role na ponte local; fallback anon.
     */
    key:
      process.env.SMARTPOS_SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '',
  },
  tables: {
    caixa: process.env.SMARTPOS_TABLE_CAIXA || 'caixa',
    abastecimentos: process.env.SMARTPOS_TABLE_ABASTECIMENTOS || 'abastecimentos',
  },
}
