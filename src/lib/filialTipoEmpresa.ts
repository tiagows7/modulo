/** Regime tributário da filial (CRT da NF-e / NFC-e). */
export type TipoEmpresa = "simples" | "simples_excesso" | "regime_normal";

export const TIPO_EMPRESA_OPTIONS: {
  value: TipoEmpresa;
  label: string;
  crt: 1 | 2 | 3;
}[] = [
  { value: "simples", label: "Simples Nacional", crt: 1 },
  {
    value: "simples_excesso",
    label: "Simples Nacional — excesso de sublimite",
    crt: 2,
  },
  { value: "regime_normal", label: "Regime Normal", crt: 3 },
];

export function normalizeTipoEmpresa(
  raw: string | null | undefined,
): TipoEmpresa {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "simples_excesso" || v === "2") return "simples_excesso";
  if (v === "regime_normal" || v === "normal" || v === "3") return "regime_normal";
  return "simples";
}

export function tipoEmpresaToCrt(raw: string | null | undefined): 1 | 2 | 3 {
  const tipo = normalizeTipoEmpresa(raw);
  if (tipo === "simples_excesso") return 2;
  if (tipo === "regime_normal") return 3;
  return 1;
}

export function labelTipoEmpresa(raw: string | null | undefined) {
  const tipo = normalizeTipoEmpresa(raw);
  return (
    TIPO_EMPRESA_OPTIONS.find((o) => o.value === tipo)?.label ||
    "Simples Nacional"
  );
}

export function isRegimeSimples(raw: string | null | undefined) {
  const crt = tipoEmpresaToCrt(raw);
  return crt === 1 || crt === 2;
}
