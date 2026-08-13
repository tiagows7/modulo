import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem } from '../data/mock'
import { aplicarCupomNosItens, lineNetTotal } from '../services/cupom/aplicarDesconto'

type CartContextValue = {
  cart: CartItem[]
  /** Total bruto (sem desconto). */
  subtotal: number
  /** Total líquido (com desconto). */
  total: number
  discountTotal: number
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
  replaceCart: (items: CartItem[]) => void
  applyDiscountCoupon: (opts: {
    couponCode: string
    productCode?: string
    tipo: string
    valor: number
    matchProduct?: boolean
  }) => { aplicado: boolean; descontoTotal: number }
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])

  const value = useMemo<CartContextValue>(() => {
    const subtotal =
      Math.round(cart.reduce((sum, item) => sum + item.qty * item.price, 0) * 100) / 100
    const discountTotal =
      Math.round(cart.reduce((sum, item) => sum + (item.discount ?? 0), 0) * 100) / 100
    const total =
      Math.round(cart.reduce((sum, item) => sum + lineNetTotal(item), 0) * 100) / 100

    return {
      cart,
      subtotal,
      total,
      discountTotal,
      addItem(item: CartItem) {
        setCart((prev) => {
          const existing = prev.find((i) => i.id === item.id)
          if (existing) {
            if (item.kind === 'produto') {
              return prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      qty: i.qty + item.qty,
                      discount: 0,
                      couponCode: undefined,
                      couponType: undefined,
                      couponValue: undefined,
                    }
                  : i,
              )
            }
            return prev
          }
          return [...prev, { ...item, discount: item.discount ?? 0 }]
        })
      },
      removeItem(id: string) {
        setCart((prev) => prev.filter((i) => i.id !== id))
      },
      clearCart() {
        setCart([])
      },
      replaceCart(items: CartItem[]) {
        setCart(items)
      },
      applyDiscountCoupon(opts) {
        let result = { aplicado: false, descontoTotal: 0 }
        setCart((prev) => {
          const applied = aplicarCupomNosItens(prev, opts)
          result = { aplicado: applied.aplicado, descontoTotal: applied.descontoTotal }
          return applied.items
        })
        return result
      },
    }
  }, [cart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve ser usado dentro de CartProvider')
  return ctx
}
