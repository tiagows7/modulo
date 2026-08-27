/**
 * Importa CST e cClassTrib IBS/CBS oficiais (portal SVRS) para:
 *   public.produto_ibscbs_cst
 *   public.produto_ibscbs_classtrib
 *
 * Fonte: https://dfe-portal.svrs.rs.gov.br/DFE/TabelaClassificacaoTributaria
 * Uso: node scripts/import-produto-ibscbs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const SOURCE_URL =
  'https://dfe-portal.svrs.rs.gov.br/DFE/TabelaClassificacaoTributaria'

const TIPO_ALIQ = {
  1: 'Fixa',
  2: 'Padrão',
  3: 'Sem Alíquota',
  4: 'Uniforme Nacional',
  5: 'Uniforme Setorial',
}

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

function bool01(v) {
  return v ? 1 : 0
}

function toDate(v) {
  if (!v) return null
  const d = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function esc(s, max) {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return max ? t.slice(0, max) : t
}

function parseDadosOriginais(html) {
  const m = html.match(/var dadosOriginais = (\[[\s\S]*?\]);\s*\n/)
  if (!m) throw new Error('Não encontrou var dadosOriginais no HTML do SVRS')
  return JSON.parse(m[1])
}

async function fetchTabela() {
  const cachePath = path.join(__dirname, 'data', 'svrs_classtrib.json')
  if (process.env.IBSCBS_USE_CACHE === '1' && fs.existsSync(cachePath)) {
    console.log(`Usando cache ${cachePath}`)
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  }

  console.log(`Baixando ${SOURCE_URL} …`)
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'pdv-web-import/1.0' },
  })
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`)
  const html = await res.text()
  const data = parseDadosOriginais(html)

  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8')
  console.log(`Cache salvo em ${cachePath}`)
  return data
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase URL/SERVICE_ROLE ausentes no .env.local')
  }

  const grupos = await fetchTabela()
  if (!Array.isArray(grupos) || grupos.length === 0) {
    throw new Error('Tabela SVRS vazia')
  }

  const cstRows = []
  const classRows = []
  const seenCst = new Set()
  const seenClass = new Set()

  for (const g of grupos) {
    const cstNum = Number(String(g.Cst ?? '').replace(/\D/g, ''))
    if (!Number.isFinite(cstNum)) continue
    if (!seenCst.has(cstNum)) {
      seenCst.add(cstNum)
      cstRows.push({
        cst: cstNum,
        descricao: esc(g.NomeCst, 100) || `CST ${String(cstNum).padStart(3, '0')}`,
        ind_gibscbs: bool01(g.IndExigeTrib),
        ind_gibscbsmono: bool01(g.IndMonofasica),
        ind_gred: bool01(g.IndReducaoAliq),
        ind_gdif: bool01(g.IndDiferimento),
        ind_gtransfcred: bool01(g.IndTransferenciaCred),
        ind_gcredpresibszfm: bool01(g.IndCredPresIbsZfm),
        ind_gajustecompet: bool01(g.IndAjusteCompet),
        ind_redutorbc: bool01(g.IndReducaoBc),
      })
    }

    for (const c of g.ClassificacoesTributarias || []) {
      const codigo = esc(c.CodClassTrib, 6)
      if (!codigo) continue
      const keyUniq = `${cstNum}|${codigo}`
      if (seenClass.has(keyUniq)) continue
      seenClass.add(keyUniq)

      const tipo = c.TipoAliq
      const tipoLabel =
        tipo == null
          ? null
          : TIPO_ALIQ[tipo]
            ? `${tipo} — ${TIPO_ALIQ[tipo]}`
            : String(tipo)

      classRows.push({
        cst: cstNum,
        codigo,
        nome: esc(c.NomeClassTrib || c.NomeReduzido, 300) || codigo,
        descricao: esc(c.NomeReduzido) || null,
        redacao: c.TexRegCbs || c.TexRegIbs || null,
        lc: esc(c.TexUrlLegislacao, 100) || null,
        tipo_aliquota: tipoLabel,
        red_ibs: Number(c.PercRedIbs) || 0,
        red_cbs: Number(c.PercRedCbs) || 0,
        trib_regular: bool01(c.IndTribRegular),
        cred_pres_oper: bool01(c.IndPermiteCredPres),
        mono_padrao: bool01(c.IndMonoVal),
        mono_reten: bool01(c.IndMonoRetem),
        mono_ret: bool01(c.IndMonoRet),
        mono_dif: bool01(c.IndMonoDif),
        estorno_cred: bool01(c.IndEstornoCred),
        inicio_vigencia: toDate(c.DthIniVig),
        final_vigencia: toDate(c.DthFimVig),
        data_atualizacao: toDate(c.DthPublicacao),
        ind_nfe_abi: bool01(c.IndNfabi),
        ind_nfe: bool01(c.IndNfe),
        ind_nfce: bool01(c.IndNfce),
        ind_cte: bool01(c.IndCte),
        ind_cteos: bool01(c.IndCteos),
        ind_bpe: bool01(c.IndBpe),
        ind_bpeta: bool01(c.IndBpeta),
        ind_bpetm: bool01(c.IndBpetm),
        ind_nf3e: bool01(c.IndNf3e),
        ind_nfse: bool01(c.IndNfse),
        ind_nfsevia: bool01(c.IndNfsvia),
        ind_nfcom: bool01(c.IndNfcom),
        ind_nfag: bool01(c.IndNfag),
        ind_nfgas: bool01(c.IndNfgas),
        ind_dere: bool01(c.IndDere),
        anexo: c.NroAnexo != null ? Number(c.NroAnexo) : null,
      })
    }
  }

  console.log(`CST: ${cstRows.length} | Class. Trib.: ${classRows.length}`)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Limpando produto_ibscbs_classtrib…')
  {
    const { error } = await supabase
      .from('produto_ibscbs_classtrib')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`Delete classtrib: ${error.message}`)
  }

  console.log('Limpando produto_ibscbs_cst…')
  {
    const { error } = await supabase
      .from('produto_ibscbs_cst')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`Delete cst: ${error.message}`)
  }

  {
    const { error } = await supabase.from('produto_ibscbs_cst').insert(cstRows)
    if (error) throw new Error(`Insert cst: ${error.message}`)
  }

  const batchSize = 100
  for (let i = 0; i < classRows.length; i += batchSize) {
    const chunk = classRows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('produto_ibscbs_classtrib')
      .insert(chunk)
    if (error) {
      throw new Error(`Insert classtrib (${i}): ${error.message}`)
    }
    console.log(`Class. Trib. ${Math.min(i + batchSize, classRows.length)}/${classRows.length}`)
  }

  console.log('Importação IBS/CBS concluída.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
