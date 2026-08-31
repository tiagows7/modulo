import { supabase } from "@/lib/supabase";

/** final teórico = inicial − venda (saídas) + entradas */
export function calcMarcacaoFinal(
  inicial: number,
  entradas: number,
  saidas: number,
) {
  return Number((inicial - saidas + entradas).toFixed(3));
}

export function calcVariacaoMarcacao(
  inicial: number,
  entradas: number,
  saidas: number,
  final: number,
) {
  const esperado = inicial + entradas - saidas;
  return Number((final - esperado).toFixed(3));
}

async function lastMarcacaoFinal(tanqueId: string, beforeDate: string) {
  const { data } = await supabase
    .from("marcacao_tanques")
    .select("marcacao_final")
    .eq("tanque", tanqueId)
    .lt("data", beforeDate)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.marcacao_final != null) return Number(data.marcacao_final) || 0;
  return 0;
}

export type EntradaTanqueLine = {
  tanqueId: string;
  produtoId: string | null;
  litros: number;
};

/**
 * Soma litros em `marcacao_tanques.entradas` na data da nota e recalcula
 * `marcacao_final = inicial - saidas_ai + entradas`.
 * Só chama ao lançar a nota (evita duplicar em regravações).
 */
export async function aplicarEntradasMarcacaoTanque(args: {
  filialId: string;
  data: string;
  lines: EntradaTanqueLine[];
}) {
  const dataIso = String(args.data || "").slice(0, 10);
  if (!args.filialId || !dataIso || !args.lines.length) return;

  const byTanque = new Map<string, EntradaTanqueLine>();
  for (const line of args.lines) {
    if (!line.tanqueId || !(line.litros > 0)) continue;
    const prev = byTanque.get(line.tanqueId);
    if (prev) {
      prev.litros += line.litros;
      if (!prev.produtoId && line.produtoId) prev.produtoId = line.produtoId;
    } else {
      byTanque.set(line.tanqueId, { ...line });
    }
  }

  for (const line of byTanque.values()) {
    const { data: existing, error: findErr } = await supabase
      .from("marcacao_tanques")
      .select(
        "id, marcacao_inicial, entradas, saidas_ai, marcacao_final, produto",
      )
      .eq("filial", args.filialId)
      .eq("tanque", line.tanqueId)
      .eq("data", dataIso)
      .maybeSingle();

    if (findErr) throw new Error(findErr.message);

    if (existing?.id) {
      const inicial = Number(existing.marcacao_inicial) || 0;
      const saidas = Number(existing.saidas_ai) || 0;
      const entradas =
        (Number(existing.entradas) || 0) + Number(line.litros || 0);
      const final = calcMarcacaoFinal(inicial, entradas, saidas);
      const { error } = await supabase
        .from("marcacao_tanques")
        .update({
          entradas,
          marcacao_final: final,
          variacao: calcVariacaoMarcacao(inicial, entradas, saidas, final),
          produto: line.produtoId || existing.produto || null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      continue;
    }

    const inicial = await lastMarcacaoFinal(line.tanqueId, dataIso);
    const entradas = Number(line.litros || 0);
    const saidas = 0;
    const final = calcMarcacaoFinal(inicial, entradas, saidas);
    const { error } = await supabase.from("marcacao_tanques").insert({
      filial: args.filialId,
      data: dataIso,
      tanque: line.tanqueId,
      produto: line.produtoId,
      marcacao_inicial: inicial,
      entradas,
      saidas_ai: saidas,
      marcacao_final: final,
      variacao: calcVariacaoMarcacao(inicial, entradas, saidas, final),
    });
    if (error) throw new Error(error.message);
  }
}
