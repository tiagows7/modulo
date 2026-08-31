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
  return null;
}

async function volumeAtualTanque(tanqueId: string) {
  const { data } = await supabase
    .from("tanques")
    .select("volume_atual")
    .eq("id", tanqueId)
    .maybeSingle();
  return data?.volume_atual != null ? Number(data.volume_atual) || 0 : 0;
}

export type EntradaTanqueLine = {
  tanqueId: string;
  produtoId: string | null;
  litros: number;
};

type TanqueFilial = {
  id: string;
  produto_id: string | null;
  volume_atual: number;
};

/**
 * Ao lançar a nota:
 * - Se ainda não houver marcação no dia da nota para a filial,
 *   cria movimento de TODOS os tanques operantes da filial,
 *   com medição inicial = marcação final do dia anterior (última data < data da nota).
 * - Soma `entradas` nos tanques informados e recalcula
 *   `marcacao_final = inicial - saidas_ai + entradas`.
 */
export async function aplicarEntradasMarcacaoTanque(args: {
  filialId: string;
  data: string;
  lines: EntradaTanqueLine[];
}) {
  const dataIso = String(args.data || "").slice(0, 10);
  if (!args.filialId || !dataIso) return;

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

  // Movimentos já existentes no dia
  const { data: existentesDia, error: existErr } = await supabase
    .from("marcacao_tanques")
    .select(
      "id, tanque, produto, marcacao_inicial, entradas, saidas_ai, marcacao_final",
    )
    .eq("filial", args.filialId)
    .eq("data", dataIso);

  if (existErr) throw new Error(existErr.message);

  const existingByTanque = new Map(
    (existentesDia ?? []).map((e) => [String(e.tanque), e]),
  );

  // Sem movimento no dia: cria todos os tanques operantes da filial
  if (!existingByTanque.size) {
    const { data: tanques, error: tanqErr } = await supabase
      .from("tanques")
      .select("id, produto_id, volume_atual")
      .eq("filial", args.filialId)
      .eq("status", "operante")
      .order("numero");

    if (tanqErr) throw new Error(tanqErr.message);

    const lista = (tanques ?? []).map(
      (t): TanqueFilial => ({
        id: String(t.id),
        produto_id: t.produto_id != null ? String(t.produto_id) : null,
        volume_atual: t.volume_atual != null ? Number(t.volume_atual) || 0 : 0,
      }),
    );

    if (!lista.length) {
      throw new Error(
        "Nenhum tanque operante cadastrado nesta filial para gerar a medição.",
      );
    }

    const inserts = [];
    for (const t of lista) {
      const entradaLine = byTanque.get(t.id);
      const prevFinal = await lastMarcacaoFinal(t.id, dataIso);
      const inicial =
        prevFinal != null ? prevFinal : t.volume_atual || 0;
      const entradas = entradaLine ? Number(entradaLine.litros) || 0 : 0;
      const saidas = 0;
      const final = calcMarcacaoFinal(inicial, entradas, saidas);
      inserts.push({
        filial: args.filialId,
        data: dataIso,
        tanque: t.id,
        produto: entradaLine?.produtoId || t.produto_id,
        marcacao_inicial: inicial,
        entradas,
        saidas_ai: saidas,
        marcacao_final: final,
        variacao: calcVariacaoMarcacao(inicial, entradas, saidas, final),
      });
    }

    const { error: insErr } = await supabase
      .from("marcacao_tanques")
      .insert(inserts);
    if (insErr) throw new Error(insErr.message);
    return;
  }

  // Já existe movimento no dia: só atualiza entradas dos tanques da nota
  // (e cria o tanque da nota se faltar naquele dia)
  for (const line of byTanque.values()) {
    const existing = existingByTanque.get(line.tanqueId);

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

    const prevFinal = await lastMarcacaoFinal(line.tanqueId, dataIso);
    const inicial =
      prevFinal != null
        ? prevFinal
        : await volumeAtualTanque(line.tanqueId);
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
