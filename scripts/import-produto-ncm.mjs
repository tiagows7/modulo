/**
 * Importa NCM/IBPT (UF RS, versão mais recente) para public.produto_ncm
 * Fonte: https://ibpt.valraw.com.br (Apache 2.0)
 *
 * Uso: node scripts/import-produto-ncm.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

const UF = process.env.IBPT_UF || 'RS'
const YEAR = process.env.IBPT_YEAR || '2026'
const TABELA = process.env.IBPT_TABELA || '26.1.L'
const URL = `https://ibpt.valraw.com.br/api/${YEAR}/${TABELA}/ncm/${UF}.json.gz`

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

  console.log(`Baixando ${URL} …`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const json = JSON.parse(zlib.gunzipSync(buf).toString('utf8'))
  const dados = Array.isArray(json.dados) ? json.dados : []
  const versao = String(json.tabela || TABELA)
  console.log(`Registros recebidos: ${dados.length} (tabela ${versao}, UF ${UF})`)

  const rows = []
  const seen = new Set()
  for (const d of dados) {
    const codigo = String(d.codigo ?? '').replace(/\D/g, '')
    if (!codigo) continue
    const ncm = Number(codigo)
    if (!Number.isFinite(ncm)) continue
    const ex = esc(d.excecao).slice(0, 10)
    const keyUniq = `${ncm}|${ex}|0`
    if (seen.has(keyUniq)) continue
    seen.add(keyUniq)

    let des = esc(d.descricao).slice(0, 100)
    if (!des) des = `NCM ${codigo}`

    rows.push({
      ibpt_ncm: ncm,
      ibpt_ex: ex || null,
      ibpt_tab: 0,
      ibpt_des: des,
      ibpt_aliq_nac: Number(d.aliquotaNacionalFederal) || 0,
      ibpt_aliq_imp: Number(d.aliquotaImportadosFederal) || 0,
      ibpt_rec: null,
      ibpt_aliq_est: Number(d.aliquotaEstadual) || 0,
      ibpt_aliq_mun: Number(d.aliquotaMunicipal) || 0,
      ibpt_chave: null,
      ibpt_versao: versao.slice(0, 10),
      ibpt_fonte: 'IBPT',
    })
  }
  console.log(`Linhas únicas para gravar: ${rows.length}`)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Limpando produto_ncm…')
  const { error: delErr } = await supabase
    .from('produto_ncm')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) throw new Error(`Delete: ${delErr.message}`)

  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('produto_ncm').insert(chunk)
    if (error) throw new Error(`Insert offset ${i}: ${error.message}`)
    console.log(`Inseridos ${Math.min(i + batchSize, rows.length)} / ${rows.length}`)
  }

  const { count, error: cErr } = await supabase
    .from('produto_ncm')
    .select('id', { count: 'exact', head: true })
  if (cErr) throw new Error(cErr.message)
  console.log(`OK — total em produto_ncm: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
