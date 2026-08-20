/**
 * Cliente HTTP PostgREST (Supabase REST).
 */
import { SMARTPOS_BRIDGE } from './config.mjs'

function assertKey() {
  if (!SMARTPOS_BRIDGE.supabase.key) {
    throw new Error(
      'SMARTPOS_SUPABASE_KEY não configurada. Defina a anon/service_role key do Supabase.',
    )
  }
}

/**
 * @param {string} path  ex: /caixa?select=*
 * @param {RequestInit & { prefer?: string }} [options]
 */
export async function supabaseRest(path, options = {}) {
  assertKey()
  const { prefer, headers: extraHeaders, ...rest } = options
  const url = `${SMARTPOS_BRIDGE.supabase.url}/rest/v1${path.startsWith('/') ? path : `/${path}`}`
  const headers = {
    apikey: SMARTPOS_BRIDGE.supabase.key,
    Authorization: `Bearer ${SMARTPOS_BRIDGE.supabase.key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
    ...(extraHeaders || {}),
  }

  const res = await fetch(url, { ...rest, headers })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.message || data.error || data.hint)) ||
      text ||
      `Supabase HTTP ${res.status}`
    const err = new Error(String(msg))
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}

export async function pingSupabase() {
  try {
    if (!SMARTPOS_BRIDGE.supabase.key) {
      return { ok: false, error: 'SMARTPOS_SUPABASE_KEY vazia' }
    }
    // ping leve: schema/table caixa (1 linha)
    const table = SMARTPOS_BRIDGE.tables.caixa
    await supabaseRest(`/${table}?select=id&limit=1`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
