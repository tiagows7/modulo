/**
 * Mesma lógica de untSrvMetodosAbastecimentos.pas — persistência via Supabase.
 *
 * - listar: caixa aberto + abastecimentos situacao=0 e selecionado_app null
 * - update tipo 0: claim (selecionado_app=1)
 * - update tipo 1: baixar (situacao=1, baixado=1, nsu/hora/pdv)
 * - update tipo 2: liberar seleção
 */
import { SMARTPOS_BRIDGE } from './config.mjs'
import { supabaseRest } from './supabase.mjs'

const T_CAIXA = () => SMARTPOS_BRIDGE.tables.caixa
const T_ABA = () => SMARTPOS_BRIDGE.tables.abastecimentos

/**
 * @param {Record<string, unknown>} row
 */
function mapAbastecimento(row) {
  const bico = String(row.bico ?? '')
  const numero = Number(row.numero ?? 0)
  return {
    id: `${bico}-${numero}`,
    bico,
    numero,
    litros: Number(row.litros ?? 0),
    preco: Number(row.preco ?? 0),
    valor: Number(row.valor ?? 0),
    aba: Number(row.aba ?? 0),
    operador: String(row.operador ?? ''),
    operadorNome: String(row.operador_nome ?? ''),
    produto: String(row.produto ?? ''),
    produtoCodigo: Number(row.produto_codigo ?? 0),
    hora: row.hora ?? null,
    raw: row,
  }
}

function dataLimiteCaixa() {
  const d = new Date()
  d.setDate(d.getDate() - 10)
  return d.toISOString().slice(0, 10)
}

/**
 * Equiv. SELECT FIRST 1 ... CUPCXA WHERE CXASIT = 0
 */
async function caixaAberto() {
  const q =
    `/${T_CAIXA()}?select=*&situacao=eq.0&data=gte.${dataLimiteCaixa()}` +
    `&order=codigo.desc&limit=1`
  const rows = await supabaseRest(q)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

/**
 * @param {{ bico?: string, operador?: string }} filters
 */
export async function listarAbastecimentos(filters = {}) {
  const caixa = await caixaAberto()
  if (!caixa) {
    return {
      ok: false,
      code: 300,
      message: 'CAIXA FECHADO.',
      items: [],
    }
  }

  let q =
    `/${T_ABA()}?select=*&situacao=eq.0&selecionado_app=is.null` +
    `&order=hora.desc.nullslast&limit=20`

  if (filters.bico) {
    q += `&bico=eq.${encodeURIComponent(String(filters.bico))}`
  }
  if (filters.operador) {
    q += `&operador=eq.${encodeURIComponent(String(filters.operador))}`
  }

  const rows = await supabaseRest(q)
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) {
    return {
      ok: false,
      code: 300,
      message: 'Nenhum abastecimento encontrado.',
      items: [],
      caixa,
    }
  }

  return {
    ok: true,
    code: 200,
    message: 'Requisição bem sucedida',
    items: list.map(mapAbastecimento),
    caixa,
  }
}

/**
 * @param {{
 *   tipo: number
 *   bico: string
 *   numero: number
 *   nsu?: string
 *   hora?: string
 *   pdv?: string
 * }} input
 */
export async function updateAbastecimento(input) {
  const tipo = Number(input.tipo)
  const bico = String(input.bico || '')
  const numero = Number(input.numero)
  if (!bico || !Number.isFinite(numero)) {
    return { ok: false, code: 400, message: 'Informe bico e numero.' }
  }

  const filter = `bico=eq.${encodeURIComponent(bico)}&numero=eq.${numero}`

  if (tipo === 0) {
    const jaBaixado = await supabaseRest(
      `/${T_ABA()}?select=numero&${filter}&situacao=eq.1&limit=1`,
    )
    if (Array.isArray(jaBaixado) && jaBaixado.length) {
      return { ok: false, code: 300, message: 'Abastecimento ja baixado.' }
    }

    const caixa = await caixaAberto()
    if (!caixa) {
      return { ok: false, code: 300, message: 'Caixa Fechado.' }
    }

    await supabaseRest(`/${T_ABA()}?${filter}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ selecionado_app: 1 }),
    })
    return { ok: true, code: 200, message: 'Requisição bem sucedida', tipo: 0 }
  }

  if (tipo === 1) {
    let nsu = String(input.nsu || '')
    if (nsu.length > 15) nsu = nsu.slice(8, 22)
    const hora = String(input.hora || '00:00:00')
    const pdv = String(input.pdv || '')

    await supabaseRest(`/${T_ABA()}?${filter}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({
        cartao_nsu: nsu,
        cartao_hora: hora,
        baixado: 1,
        situacao: 1,
        pdv,
      }),
    })
    return { ok: true, code: 200, message: 'Requisição bem sucedida', tipo: 1 }
  }

  // tipo 2 — liberar
  await supabaseRest(`/${T_ABA()}?${filter}&situacao=eq.0`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({
      selecionado_app: null,
      cartao_nsu: String(input.nsu || '') || null,
      cartao_hora: null,
      baixado: null,
      situacao: 0,
    }),
  })
  return { ok: true, code: 200, message: 'Requisição bem sucedida', tipo: 2 }
}
