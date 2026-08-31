import { supabase } from '@/lib/supabase'

function onlyDigits(v: string) {
  return String(v || '').replace(/\D/g, '')
}

function formatCnpj(digits: string) {
  const d = onlyDigits(digits)
  if (d.length !== 14) return d || null
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

async function nextTitulo(filialId: string, fornecedorId: string, prefer?: string | null) {
  const preferred = String(prefer || '').trim().slice(0, 15)
  if (preferred) {
    const { data } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('filial', filialId)
      .eq('fornecedor', fornecedorId)
      .eq('titulo', preferred)
      .maybeSingle()
    if (!data) return preferred
  }

  const { data: rows } = await supabase
    .from('contas_pagar')
    .select('titulo')
    .eq('filial', filialId)
    .eq('fornecedor', fornecedorId)
    .order('created_at', { ascending: false })
    .limit(80)

  let max = 0
  for (const row of rows ?? []) {
    const m = String(row.titulo ?? '').match(/(\d+)/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return String(max + 1).slice(0, 15)
}

async function resolveFornecedorId(opts: {
  fornecedorId: string | null
  cnpj: string | null
  nome: string | null
}): Promise<string> {
  if (opts.fornecedorId) return opts.fornecedorId

  const cnpj = onlyDigits(opts.cnpj || '')
  if (cnpj.length !== 14) {
    throw new Error(
      'Fornecedor não identificado. Importe o XML ou cadastre o fornecedor antes de lançar a despesa.',
    )
  }

  const { data: existentes, error } = await supabase
    .from('fornecedores')
    .select('id, cnpj')
  if (error) throw new Error(error.message)

  const found = (existentes ?? []).find(
    (f) => onlyDigits(String(f.cnpj || '')) === cnpj,
  )
  if (found) return String(found.id)

  const { data: codRows } = await supabase
    .from('fornecedores')
    .select('codigo')
    .order('created_at', { ascending: false })
    .limit(50)
  let max = 0
  for (const row of codRows ?? []) {
    const m = String(row.codigo ?? '').match(/(\d+)/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const codigo = `FOR-${String(max + 1).padStart(3, '0')}`
  const razao = (opts.nome || '').trim() || `Fornecedor ${formatCnpj(cnpj)}`

  const { data: created, error: insErr } = await supabase
    .from('fornecedores')
    .insert({
      codigo,
      razao_social: razao.slice(0, 255),
      cnpj: formatCnpj(cnpj),
      status: 'ativo',
    })
    .select('id')
    .single()
  if (insErr) throw new Error(insErr.message)
  return String(created.id)
}

export type ManifestoDespesaInput = {
  id: string
  filial: string | null
  fornecedor: string | null
  fornecedor_cnpj: string | null
  fornecedor_nome: string | null
  numero: number | null
  emissao: string | null
  valor: number
  chave: string | null
}

/**
 * Lança somente em contas_pagar (tipo despesa), sem criar nota_entrada.
 * Marca o manifesto como despesa/digitada.
 */
export async function lancarDespesaFromManifesto(
  item: ManifestoDespesaInput,
): Promise<{ contasPagarId: string; titulo: string }> {
  if (!item.filial) {
    throw new Error('Manifesto sem filial. Selecione a filial antes de consultar/importar.')
  }

  const fornecedorId = await resolveFornecedorId({
    fornecedorId: item.fornecedor,
    cnpj: item.fornecedor_cnpj,
    nome: item.fornecedor_nome,
  })

  const titulo = await nextTitulo(
    item.filial,
    fornecedorId,
    item.numero != null ? String(item.numero) : null,
  )

  const emissao = item.emissao ? String(item.emissao).slice(0, 10) : null
  const hoje = new Date().toISOString().slice(0, 10)
  const valor = Number(item.valor) || 0

  const { data: conta, error: contaErr } = await supabase
    .from('contas_pagar')
    .insert({
      fornecedor: fornecedorId,
      titulo,
      nota_entrada: null,
      finalidade: 'Despesa do posto',
      filial: item.filial,
      tipo: 'despesa',
      data_emissao: emissao,
      data_chegada: hoje,
      data_vencimento: emissao || hoje,
      valor,
      valor_saldo: valor,
      valor_outros: 0,
      situacao: 0,
    })
    .select('id')
    .single()

  if (contaErr) throw new Error(contaErr.message)

  const ano = new Date().getFullYear()
  const { data: numData, error: numErr } = await supabase.rpc(
    'next_contas_pagar_numero_pagamento',
    { p_ano: ano },
  )
  if (numErr) throw new Error(numErr.message)
  const numeroPagamento = Number(numData) || 1

  const { error: movErr } = await supabase.from('contas_pagarpagamento').insert({
    contas_pagar: conta.id,
    filial: item.filial,
    fornecedor: fornecedorId,
    titulo,
    data_movimento: hoje,
    hora_lancamento: new Date().toISOString(),
    tipo: 'despesa',
    tipo_transacao: 'inclusao',
    sinal: -1,
    valor,
    valor_desconto: 0,
    valor_juros: 0,
    observacao: item.chave ? item.chave.slice(0, 30) : 'Manifesto SEFAZ',
    numero_pagamento_ano: ano,
    numero_pagamento: numeroPagamento,
  })
  if (movErr) throw new Error(movErr.message)

  const { error: manErr } = await supabase
    .from('nota_entradamanifesto')
    .update({ despesa: 1, digitada: 1 })
    .eq('id', item.id)
  if (manErr) throw new Error(manErr.message)

  return { contasPagarId: String(conta.id), titulo }
}
