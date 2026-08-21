/**
 * Importa municípios brasileiros (código IBGE, nome, UF)
 * Fonte: API IBGE — https://servicodados.ibge.gov.br/api/v1/localidades/municipios
 *
 * Uso: node --env-file=.env.local scripts/importCidades.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const IBGE_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'

function extrairUf(municipio) {
  const micro = municipio?.microrregiao
  const meso = micro?.mesorregiao
  if (meso?.UF?.sigla) return String(meso.UF.sigla).toUpperCase()

  const imediata = municipio?.['regiao-imediata']
  const intermediaria = imediata?.['regiao-intermediaria']
  if (intermediaria?.UF?.sigla) return String(intermediaria.UF.sigla).toUpperCase()

  return ''
}

async function main() {
  console.log('Baixando municípios do IBGE…')
  const res = await fetch(IBGE_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`Falha na API IBGE (HTTP ${res.status})`)
  }

  const lista = await res.json()
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new Error('API IBGE retornou lista vazia')
  }

  const rows = []
  const skipped = []
  for (const item of lista) {
    const codigo = String(item.id ?? '').trim()
    const descricao = String(item.nome ?? '').trim()
    const uf = extrairUf(item)
    if (!codigo || !descricao || !uf) {
      skipped.push({ id: item.id, nome: item.nome, uf })
      continue
    }
    rows.push({ codigo, descricao, uf })
  }

  console.log(`Municípios válidos: ${rows.length} (ignorados: ${skipped.length})`)

  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from('cidades').upsert(batch, {
      onConflict: 'codigo',
      ignoreDuplicates: false,
    })
    if (error) {
      throw new Error(`Erro no lote ${i / batchSize + 1}: ${error.message}`)
    }
    inserted += batch.length
    console.log(`Gravados ${inserted}/${rows.length}`)
  }

  const { count, error: countError } = await supabase
    .from('cidades')
    .select('*', { count: 'exact', head: true })

  if (countError) throw new Error(countError.message)
  console.log(`Concluído. Total na tabela cidades: ${count}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
