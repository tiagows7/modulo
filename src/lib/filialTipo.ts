export type TipoFilial = "posto" | "empresa";

export function normalizeTipoFilial(raw: string | null | undefined): TipoFilial {
  return String(raw || "").trim().toLowerCase() === "empresa"
    ? "empresa"
    : "posto";
}

export function isFilialPosto(raw: string | null | undefined) {
  return normalizeTipoFilial(raw) === "posto";
}

export function labelTipoFilial(raw: string | null | undefined) {
  return isFilialPosto(raw) ? "Posto de combustível" : "Outra empresa";
}
