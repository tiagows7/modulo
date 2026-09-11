import { supabase } from '@/lib/supabase'
import { getPdvCodigo, getUltimoCaixa } from '../caixa/caixaDb'
import { getOperadorFilialId } from '../produtos/buscarProduto'
import type { FiscalDocTipo } from '../fiscal/types'

export type ConfiguracaoTef = {
  filial: string
  pdv: number
  tipo: number | null
  ip_tef: string | null
  idterminal: string | null
  idloja: string | null
  cnpj: string | null
  nfceserie: number | null
  nfcenumero: number | null
  nfeserie: number | null
  nfenumero: number | null
}

export type NumeroFiscalReservado = {
  numero: number
  serie: number
}

function pdvNumero(value: string | null | undefined): number | null {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  const numero = Number.parseInt(digits, 10)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

async function contextoAtual(): Promise<{
  filialId: string | null
  pdv: number | null
}> {
  const codigoPdv = getPdvCodigo()
  const caixa = await getUltimoCaixa(codigoPdv).catch(() => null)
  return {
    filialId: caixa?.filial || (await getOperadorFilialId()),
    pdv: pdvNumero(caixa?.pdv || codigoPdv),
  }
}

/** Configuração TEF da filial e do PDV em uso. */
export async function getConfiguracaoTefAtual(): Promise<ConfiguracaoTef | null> {
  const { filialId, pdv } = await contextoAtual()
  if (!filialId || !pdv) return null

  const { data, error } = await supabase
    .from('configuracao_tef')
    .select(
      'filial,pdv,tipo,ip_tef,idterminal,idloja,cnpj,nfceserie,nfcenumero,nfeserie,nfenumero',
    )
    .eq('filial', filialId)
    .eq('pdv', pdv)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as ConfiguracaoTef) : null
}

/**
 * Reserva o número configurado e incrementa o próximo número no banco.
 * A função SQL usa bloqueio de linha para evitar duplicidade entre emissões.
 */
export async function reservarNumeroFiscalTef(
  tipo: FiscalDocTipo,
): Promise<NumeroFiscalReservado> {
  const { filialId, pdv } = await contextoAtual()
  if (!filialId) {
    throw new Error('Filial do operador não encontrada para reservar a numeração fiscal.')
  }
  if (!pdv) {
    throw new Error('Número do PDV inválido para reservar a numeração fiscal.')
  }

  const { data, error } = await supabase.rpc('reservar_numero_fiscal_tef', {
    p_filial: filialId,
    p_pdv: pdv,
    p_modelo: tipo === 'NFC-e' ? 65 : 55,
  })

  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  const numero = Number((row as Record<string, unknown> | null)?.numero)
  const serie = Number((row as Record<string, unknown> | null)?.serie)
  if (!Number.isInteger(numero) || numero <= 0 || !Number.isInteger(serie) || serie <= 0) {
    throw new Error(`Série/número de ${tipo} inválidos na configuração TEF.`)
  }

  return { numero, serie }
}
