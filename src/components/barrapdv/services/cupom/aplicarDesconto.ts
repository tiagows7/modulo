import type { CartItem } from '../../data/mock'
import type { CupomTipoDesconto } from './validarCupom'

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Calcula PRODSC conforme case Delphi (percentual | valor | valor_unitario).
 */
export function calcularDescontoLinha(
  item: CartItem,
  tipo: string,
  valor: number,
): number {
  const totalBruto = round2(item.qty * item.price)
  const t = String(tipo || '').toLowerCase() as CupomTipoDesconto

  if (t === 'percentual') {
    return round2((totalBruto * valor) / 100)
  }

  if (t === 'valor') {
    const unitario = item.price - valor
    const valorRecalculado = round2(item.qty * unitario)
    return round2(totalBruto - valorRecalculado)
  }

  if (t === 'valor_unitario') {
    const valorRecalculado = round2(item.qty * valor)
    return round2(totalBruto - valorRecalculado)
  }

  return 0
}

export function isCupomTipoValido(tipo: string): tipo is CupomTipoDesconto {
  const t = String(tipo || '').toLowerCase()
  return t === 'percentual' || t === 'valor' || t === 'valor_unitario'
}

export type AplicarCupomResult = {
  items: CartItem[]
  aplicado: boolean
  descontoTotal: number
}

/**
 * Aplica cupom nos itens.
 * Sem banco PDV: não filtra por produto — usa só o tipo de desconto.
 */
export function aplicarCupomNosItens(
  cart: CartItem[],
  opts: {
    couponCode: string
    productCode?: string
    tipo: string
    valor: number
    /** Quando true, exige productCode = PROCOD (fluxo Delphi completo). */
    matchProduct?: boolean
  },
): AplicarCupomResult {
  let aplicado = false
  let descontoTotal = 0
  const matchProduct = Boolean(opts.matchProduct)

  if (!isCupomTipoValido(opts.tipo)) {
    return {
      items: cart.map((item) => ({
        ...item,
        discount: 0,
        couponCode: undefined,
        couponType: undefined,
        couponValue: undefined,
      })),
      aplicado: false,
      descontoTotal: 0,
    }
  }

  const items = cart.map((item) => {
    const base: CartItem = {
      ...item,
      discount: 0,
      couponCode: undefined,
      couponType: undefined,
      couponValue: undefined,
    }

    if (matchProduct) {
      const a = String(item.productCode ?? '').trim()
      const b = String(opts.productCode ?? '').trim()
      const na = Number(a)
      const nb = Number(b)
      const same =
        Boolean(a) &&
        Boolean(b) &&
        (Number.isFinite(na) && Number.isFinite(nb) ? na === nb : a === b)
      if (!same) return base
    }

    const desconto = Math.max(0, calcularDescontoLinha(item, opts.tipo, opts.valor))
    aplicado = true
    descontoTotal = round2(descontoTotal + desconto)

    return {
      ...base,
      discount: desconto,
      couponCode: opts.couponCode,
      couponType: opts.tipo,
      couponValue: opts.valor,
    }
  })

  return { items, aplicado, descontoTotal }
}

export function lineNetTotal(item: CartItem) {
  return round2(item.qty * item.price - (item.discount ?? 0))
}
