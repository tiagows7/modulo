import { supabase } from "@/lib/supabase";

/**
 * Gera título único por (filial, fornecedor) — constraint
 * contas_pagar_filial_fornecedor_titulo_key.
 * Se `prefer` estiver livre, usa; senão incrementa numérico.
 */
export async function nextContasPagarTitulo(
  filialId: string,
  fornecedorId: string,
  prefer?: string | null,
  reservados: Set<string> = new Set(),
): Promise<string> {
  const preferred = String(prefer || "")
    .trim()
    .slice(0, 15);

  const ocupado = async (titulo: string) => {
    if (reservados.has(titulo)) return true;
    const { data } = await supabase
      .from("contas_pagar")
      .select("id")
      .eq("filial", filialId)
      .eq("fornecedor", fornecedorId)
      .eq("titulo", titulo)
      .maybeSingle();
    return Boolean(data);
  };

  if (preferred && !(await ocupado(preferred))) {
    reservados.add(preferred);
    return preferred;
  }

  const { data: rows } = await supabase
    .from("contas_pagar")
    .select("titulo")
    .eq("filial", filialId)
    .eq("fornecedor", fornecedorId)
    .order("created_at", { ascending: false })
    .limit(200);

  let max = 0;
  for (const row of rows ?? []) {
    const m = String(row.titulo ?? "").match(/(\d+)/);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  for (const r of reservados) {
    const m = r.match(/(\d+)/);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }

  let n = max + 1;
  let candidate = String(n).slice(0, 15);
  while (await ocupado(candidate)) {
    n += 1;
    candidate = String(n).slice(0, 15);
  }
  reservados.add(candidate);
  return candidate;
}
