/**
 * Importa tabela CEST × NCM para public.produto_cest
 * Fonte: https://github.com/idfsistemas/br-data (data/cest/data.json)
 *
 * Uso: node scripts/import-produto-cest.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const SOURCE =
  process.env.CEST_URL ||
  'https://raw.githubusercontent.com/idfsistemas/br-data/master/data/cest/data.json'

function loadEnv() {
  const envPath = path.join(root, '.env.local')
  const text = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

function esc(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase URL/SERVICE_ROLE ausentes no .env.local')

  console.log(`Baixando ${SOURCE} …`)
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`)
  const dados = await res.json()
  if (!Array.isArray(dados)) throw new Error('JSON inválido: esperado array')

  const rows = []
  const seen = new Set()
  for (const item of dados) {
    const codigo = String(item.cest ?? '')
      .replace(/\D/g, '')
      .padStart(7, '0')
      .slice(0, 9)
    if (!codigo) continue
    const descricao = esc(item.descricao) || `CEST ${codigo}`
    const ncms = Array.isArray(item.ncms) ? item.ncms : []
    if (ncms.length === 0) {
      const keyUniq = `${codigo}|`
      if (seen.has(keyUniq)) continue
      seen.add(keyUniq)
      rows.push({ codigo, descricao, ncm: null })
      continue
    }
    for (const n of ncms) {
      const ncm = String(n ?? '')
        .replace(/\D/g, '')
        .slice(0, 8)
      if (!ncm) continue
      const keyUniq = `${codigo}|${ncm}`
      if (seen.has(keyUniq)) continue
      seen.add(keyUniq)
      rows.push({ codigo, descricao, ncm })
    }
  }
  console.log(`Linhas CEST×NCM: ${rows.length}`)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Limpando produto_cest…')
  const { error: delErr } = await supabase
    .from('produto_cest')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw new Error(`Delete: ${delErr.message}`)

  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('produto_cest').insert(chunk)
    if (error) throw new Error(`Insert offset ${i}: ${error.message}`)
    console.log(`Inseridos ${Math.min(i + batchSize, rows.length)} / ${rows.length}`)
  }

  const { count, error: cErr } = await supabase
    .from('produto_cest')
    .select('id', { count: 'exact', head: true })
  if (cErr) throw new Error(cErr.message)
  console.log(`OK — total em produto_cest: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
