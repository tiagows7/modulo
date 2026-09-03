import type { ModeloFiscal } from "./types";

export function onlyDigitsDoc(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Regra de modelo:
 * - documento em branco ou CPF (≤11 dígitos) → NFC-e
 * - CNPJ (14 dígitos) → NF-e
 */
export function decidirTipoDocumento(
  document?: string | null,
  forced?: ModeloFiscal | null,
): ModeloFiscal {
  if (forced === "NFC-e" || forced === "NF-e") return forced;
  const digits = onlyDigitsDoc(document);
  if (!digits) return "NFC-e";
  if (digits.length === 14) return "NF-e";
  return "NFC-e";
}

export function modeloCodigo(tipo: ModeloFiscal): "65" | "55" {
  return tipo === "NFC-e" ? "65" : "55";
}
