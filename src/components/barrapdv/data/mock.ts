export type FuelType = {
  id: string
  name: string
  shortName: string
  price: number
  unit: 'L'
  color: string
  /** Código produto ERP (PROCOD) — cupom de desconto. */
  productCode: number
}

export type Pump = {
  id: number
  status: 'livre' | 'abastecendo' | 'finalizado' | 'bloqueado'
  fuelId: string | null
  liters: number
  amount: number
  plate?: string
}

export type Filling = {
  id: string
  nozzle: number
  fuelId: string
  quantity: number
  unitPrice: number
  total: number
  date: string
  time: string
  operator: string
  status: 'disponivel' | 'abastecendo' | 'lancado'
  /** 0 = aberto no grid · 1 = usado/baixado */
  situacao: 0 | 1
}

export type Product = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  /** Código produto ERP (PROCOD) — cupom de desconto. */
  productCode: number
}

export type CartItem = {
  id: string
  name: string
  qty: number
  price: number
  unit: string
  kind: 'combustivel' | 'produto'
  pumpId?: number
  /** Código produto ERP (PROCOD). */
  productCode?: number | string
  /** Desconto da linha (PRODSC). */
  discount?: number
  couponCode?: string
  couponType?: string
  couponValue?: number
}

export const fuels: FuelType[] = [
  { id: 'gc', name: 'Gasolina Comum', shortName: 'Gas. Comum', price: 5.89, unit: 'L', color: '#e8b923', productCode: 1 },
  { id: 'ga', name: 'Gasolina Aditivada', shortName: 'Gas. Adit.', price: 6.19, unit: 'L', color: '#f0a500', productCode: 2 },
  { id: 'et', name: 'Etanol', shortName: 'Etanol', price: 3.99, unit: 'L', color: '#5ecf8a', productCode: 3 },
  { id: 'd10', name: 'Diesel S10', shortName: 'Diesel S10', price: 5.79, unit: 'L', color: '#4a5568', productCode: 4 },
  { id: 'd500', name: 'Diesel S500', shortName: 'Diesel S500', price: 5.59, unit: 'L', color: '#2d3748', productCode: 5 },
]

export const pumps: Pump[] = [
  { id: 1, status: 'finalizado', fuelId: 'gc', liters: 42.5, amount: 250.33, plate: 'ABC1D23' },
  { id: 2, status: 'abastecendo', fuelId: 'et', liters: 18.2, amount: 72.62 },
  { id: 3, status: 'livre', fuelId: null, liters: 0, amount: 0 },
  { id: 4, status: 'finalizado', fuelId: 'd10', liters: 80.0, amount: 463.2, plate: 'XYZ9K88' },
  { id: 5, status: 'livre', fuelId: null, liters: 0, amount: 0 },
  { id: 6, status: 'bloqueado', fuelId: null, liters: 0, amount: 0 },
  { id: 7, status: 'abastecendo', fuelId: 'ga', liters: 25.0, amount: 154.75 },
  { id: 8, status: 'livre', fuelId: null, liters: 0, amount: 0 },
]

export const fillings: Filling[] = Array.from({ length: 50 }, (_, index) => {
  const fuel = fuels[index % fuels.length]
  const nozzle = (index % 8) + 1
  const quantity = Number((12 + ((index * 7) % 90) + (index % 10) / 10).toFixed(2))
  const unitPrice = fuel.price
  const total = Number((quantity * unitPrice).toFixed(2))
  const hour = 8 + Math.floor(index / 4)
  const minute = (index * 3) % 60
  const operator = index % 2 === 0 ? 'Carlos Silva' : 'Ana Souza'
  const status: Filling['status'] =
    index === 0
      ? 'disponivel'
      : index % 11 === 0
        ? 'abastecendo'
        : index % 17 === 0
          ? 'lancado'
          : 'disponivel'

  return {
    id: `f${index + 1}`,
    nozzle,
    fuelId: fuel.id,
    quantity,
    unitPrice,
    total,
    date: '21/07/2026',
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    operator,
    status,
    situacao: status === 'lancado' ? 1 : 0,
  }
})

export const products: Product[] = [
  { id: 'p1', name: 'Óleo Motor 1L', category: 'Lubrificantes', price: 42.9, unit: 'un', productCode: 101 },
  { id: 'p2', name: 'Aditivo Radiador', category: 'Lubrificantes', price: 18.5, unit: 'un', productCode: 102 },
  { id: 'p3', name: 'Água Mineral 500ml', category: 'Conveniência', price: 3.5, unit: 'un', productCode: 103 },
  { id: 'p4', name: 'Refrigerante 350ml', category: 'Conveniência', price: 5.0, unit: 'un', productCode: 104 },
  { id: 'p5', name: 'Café Expresso', category: 'Conveniência', price: 4.5, unit: 'un', productCode: 105 },
  { id: 'p6', name: 'Salgadinho', category: 'Conveniência', price: 8.0, unit: 'un', productCode: 106 },
  { id: 'p7', name: 'Chocolate', category: 'Conveniência', price: 6.5, unit: 'un', productCode: 107 },
  { id: 'p8', name: 'Pano Microfibra', category: 'Acessórios', price: 15.9, unit: 'un', productCode: 108 },
  { id: 'p9', name: 'Palheta Dianteira', category: 'Acessórios', price: 39.9, unit: 'un', productCode: 109 },
  { id: 'p10', name: 'Fluido de Freio', category: 'Lubrificantes', price: 22.0, unit: 'un', productCode: 110 },
  { id: 'p11', name: 'Gás Isqueiro', category: 'Conveniência', price: 12.0, unit: 'un', productCode: 111 },
  { id: 'p12', name: 'Kit Limpeza', category: 'Acessórios', price: 29.9, unit: 'un', productCode: 112 },
]

export const station = {
  id: '1',
  name: 'Posto Horizonte',
  tradeName: 'Posto Horizonte',
  document: '00.000.000/0001-00',
}

export const operators = [
  { id: '1', name: 'Carlos Silva', role: 'Operador', pin: '1234' },
  { id: '2', name: 'Ana Souza', role: 'Supervisora', pin: '5678' },
]

export const paymentMethods = [
  { id: 'dinheiro', label: 'Dinheiro', icon: 'cash' },
  { id: 'cartao_pos', label: 'Cartão POS', icon: 'card' },
  { id: 'tef', label: 'TEF', icon: 'card' },
  { id: 'pix', label: 'PIX', icon: 'pix' },
  { id: 'vale', label: 'Vale / Frota', icon: 'fleet' },
] as const

/** Bandeiras / produtos das máquinas POS (fora do SiTef). */
export const posCardOptions = [
  { id: 'visa-credito', label: 'Visa Crédito' },
  { id: 'visa-debito', label: 'Visa Débito' },
  { id: 'master-credito', label: 'Mastercard Crédito' },
  { id: 'master-debito', label: 'Mastercard Débito' },
  { id: 'elo-credito', label: 'Elo Crédito' },
  { id: 'elo-debito', label: 'Elo Débito' },
  { id: 'amex', label: 'American Express' },
  { id: 'hipercard', label: 'Hipercard' },
  { id: 'cabal', label: 'Cabal' },
  { id: 'sorocred', label: 'Sorocred' },
] as const

export type Vehicle = {
  id: string
  plate: string
  model: string
  fleet: string
  driver: string
  customerCode: string
  customerName: string
}

export const vehicles: Vehicle[] = [
  {
    id: 'v1',
    plate: 'ABC1D23',
    model: 'Fiat Strada',
    fleet: 'FROTA-01',
    driver: 'João Pereira',
    customerCode: 'C001',
    customerName: 'Transportes Horizonte Ltda',
  },
  {
    id: 'v2',
    plate: 'XYZ9K88',
    model: 'VW Delivery',
    fleet: 'FROTA-02',
    driver: 'Marcos Lima',
    customerCode: 'C001',
    customerName: 'Transportes Horizonte Ltda',
  },
  {
    id: 'v3',
    plate: 'QWE4R56',
    model: 'Mercedes Accelo',
    fleet: 'FROTA-07',
    driver: 'Paulo Mendes',
    customerCode: 'C014',
    customerName: 'Prefeitura Municipal',
  },
  {
    id: 'v4',
    plate: 'JKL2M34',
    model: 'Toyota Hilux',
    fleet: 'FROTA-03',
    driver: 'Ricardo Alves',
    customerCode: 'C008',
    customerName: 'Construtora Vale Norte',
  },
  {
    id: 'v5',
    plate: 'RTY7U89',
    model: 'Ford Ranger',
    fleet: 'FROTA-05',
    driver: 'André Costa',
    customerCode: 'C008',
    customerName: 'Construtora Vale Norte',
  },
]

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Preço por litro — 3 casas decimais (padrão combustível). */
export function formatUnitPrice(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

export function formatLiters(value: number) {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
}
