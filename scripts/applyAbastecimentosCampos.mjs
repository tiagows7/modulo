/**
 * Aplica colunas novas em public.abastecimentos via PostgREST não cobre DDL —
 * usa a Management... na prática rodamos SQL com service role via rpc se existir,
 * senão documenta. Aqui tentamos via supabase REST com uma function auxiliar
 * ou instruímos o SQL Editor.
 *
 * Preferência: executar o SQL do arquivo 08_abastecimentos_campos.sql no painel.
 * Este script valida as colunas com um select.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sql = fs.readFileSync(
  path.join(root, 'scripts', '08_abastecimentos_campos.sql'),
  'utf8',
)

// Tenta exec_sql se existir no projeto; senão aplica coluna a coluna via hack não disponível.
const { error: rpcErr } = await sb.rpc('exec_sql', { query: sql })
if (rpcErr) {
  console.log('RPC exec_sql indisponível — aplicando via statements individuais no REST não é possível.')
  console.log('Validando colunas com probe INSERT/SELECT...')
}

const needed = [
  'data',
  'medicao',
  'caixa_operador',
  'caixa_data',
  'caixa_turno',
  'caixa_codigo',
  'documento',
  'cupom',
]

const { data, error } = await sb.from('abastecimentos').select('*').limit(1)
if (error) {
  console.error('Falha ao ler abastecimentos:', error.message)
  process.exit(1)
}

const cols = data?.[0] ? Object.keys(data[0]) : null
if (!cols) {
  // tabela vazia — tenta insert mínimo e rollback mental: usa information via error on missing col
  const probe = await sb
    .from('abastecimentos')
    .insert({
      bico: '__probe__',
      numero: -1,
      litros: 0,
      preco: 0,
      valor: 0,
      data: '2000-01-01',
      medicao: 0,
      caixa_operador: 'probe',
      caixa_data: '2000-01-01',
      caixa_turno: '1',
      caixa_codigo: 0,
      documento: null,
      cupom: null,
    })
    .select('*')
    .single()

  if (probe.error) {
    console.error('Colunas ainda não existem. Rode no SQL Editor do Supabase:')
    console.error('  scripts/08_abastecimentos_campos.sql')
    console.error('Detalhe:', probe.error.message)
    process.exit(2)
  }

  await sb.from('abastecimentos').delete().eq('bico', '__probe__').eq('numero', -1)
  console.log('OK — colunas presentes (tabela estava vazia).')
  process.exit(0)
}

const missing = needed.filter((c) => !cols.includes(c))
if (missing.length) {
  console.error('Faltam colunas:', missing.join(', '))
  console.error('Rode no SQL Editor: scripts/08_abastecimentos_campos.sql')
  process.exit(2)
}

console.log('OK — colunas:', needed.join(', '))
