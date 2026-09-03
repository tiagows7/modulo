/** Ambiente SEFAZ (tpAmb): 1 = Produção, 2 = Homologação */
export type AmbienteFiscal = 1 | 2

export function normalizeAmbienteFiscal(value: unknown): AmbienteFiscal {
  const n = typeof value === "number" ? value : Number(value)
  return n === 1 ? 1 : 2
}

export function labelAmbienteFiscal(value: unknown): string {
  return normalizeAmbienteFiscal(value) === 1 ? "Produção" : "Homologação"
}
