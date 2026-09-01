/** Máscaras e parse de valores monetários / decimais (pt-BR). */

export function parseMoney(raw: string): number {
  const t = String(raw).trim().replace(/\s/g, "")
  if (!t) return 0
  if (t.includes(",")) {
    const n = Number(t.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : 0
  }
  // Sem vírgula: "5.000" / "1.234.567" = milhar (toLocaleString pt-BR), não decimal.
  // Number("5.000") === 5 — bug clássico ao formatar e reparsear.
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    const n = Number(t.replace(/\./g, ""))
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

export function formatMoney2(n: number | string | null | undefined): string {
  const v = typeof n === "number" ? n : parseMoney(String(n ?? "0"))
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Digitação livre: dígitos + uma vírgula (até `maxDecimals` casas). */
export function maskMoneyInput(raw: string, maxDecimals = 2): string {
  let v = String(raw).replace(/[^\d,]/g, "")
  const parts = v.split(",")
  const intPart = (parts[0] ?? "").replace(/\D/g, "")
  if (parts.length === 1) return intPart
  const dec = (parts[1] ?? "").replace(/\D/g, "").slice(0, maxDecimals)
  return `${intPart},${dec}`
}

/** Quantidade com até 4 casas decimais. */
export function maskQtyInput(raw: string): string {
  return maskMoneyInput(raw, 4)
}

export function formatQty(n: number | string | null | undefined, decimals = 4): string {
  const v = typeof n === "number" ? n : parseMoney(String(n ?? "0"))
  // Sem agrupamento de milhar: evita "5.000" → parseMoney → 5
  return v.toLocaleString("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

