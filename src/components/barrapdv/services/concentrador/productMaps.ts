/** Mapa código produto CBC → id combustível PDV */
export const PRODUCT_MAP: Record<string, string> = {
  '01': 'gc',
  '02': 'ga',
  '03': 'et',
  '04': 'd10',
  '05': 'd500',
}

/** Fallback por bico quando o frame CBC não traz código de produto */
export const NOZZLE_FUEL_MAP: Record<number, string> = {
  1: 'gc',
  2: 'ga',
  3: 'et',
  4: 'd10',
  5: 'd500',
  6: 'gc',
  7: 'ga',
  8: 'et',
}
