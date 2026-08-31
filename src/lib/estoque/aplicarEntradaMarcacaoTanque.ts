import { supabase } from "@/lib/supabase";

/** marcacao_final teórico = inicial + entradas − saídas */
export function calcMarcacaoFinal(
  inicial: number,
  entradas: number,
  saidas: number,
) {
  return Number((inicial + entradas - saidas).toFixed(3));
}

/** variação = inicial + entradas − saídas − final */
export function calcVariacaoMarcacao(
  inicial: number,
  entradas: number,
  saidas: number,
  final: number,
) {
  return Number((inicial + entradas - saidas - final).toFixed(3));
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

export type EntradaTanqueLine = {
  tanqueId: string;
  produtoId: string | null;
  litros: number;
};

type ExistingRow = {
  id: string;
  tanque: string;
  produto: string | null;
  marcacao_inicial: number;
  entradas: number;
  saidas_ai: number;
  marcacao_final: number;
};

/**
 * Ao lançar a nota (situação = lançada):
 * 1) Garante movimento no dia para TODOS os tanques operantes da filial
 *    (inicial = final do último dia anterior à data da nota).
 * 2) Soma/aplica as entradas dos tanques informados na nota e recalcula
 *    marcacao_final = inicial − saidas + entradas.
 *
 * `modo`:
 * - "somar": adiciona litros (primeira vez que a nota vira lançada)
 * - "reparar": se o tanque está com entradas=0, grava os litros (regravação / correção)
 */
export async function aplicarEntradasMarcacaoTanque(args: {
  filialId: string;
  data: string;
  lines: EntradaTanqueLine[];
  modo?: "somar" | "reparar";
}) {
  const dataIso = String(args.data || "").slice(0, 10);
  const modo = args.modo ?? "somar";
  if (!args.filialId || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    throw new Error("Filial e data de entrada (AAAA-MM-DD) são obrigatórias para a medição.");
  }

  const byTanque = new Map<string, EntradaTanqueLine>();
  for (const line of args.lines) {
    if (!line.tanqueId || !(Number(line.litros) > 0)) continue;
    const prev = byTanque.get(line.tanqueId);
    if (prev) {
      prev.litros += Number(line.litros) || 0;
      if (!prev.produtoId && line.produtoId) prev.produtoId = line.produtoId;
    } else {
      byTanque.set(line.tanqueId, {
        tanqueId: line.tanqueId,
        produtoId: line.produtoId,
        litros: Number(line.litros) || 0,
      });
    }
  }

  const { data: tanques, error: tanqErr } = await supabase
    .from("tanques")
    .select("id, produto_id, volume_atual, numero")
    .eq("filial", args.filialId)
    .eq("status", "operante")
    .order("numero");

  if (tanqErr) throw new Error(tanqErr.message);

  const lista = (tanques ?? []).map((t) => ({
    id: String(t.id),
    produto_id: t.produto_id != null ? String(t.produto_id) : null,
    volume_atual: t.volume_atual != null ? Number(t.volume_atual) || 0 : 0,
  }));

  if (!lista.length) {
    throw new Error(
      "Nenhum tanque operante cadastrado nesta filial para gerar a medição.",
    );
  }

  // Tanques da nota que não estão na lista operante/filial — ainda assim inclui
  for (const line of byTanque.values()) {
    if (!lista.some((t) => t.id === line.tanqueId)) {
      lista.push({
        id: line.tanqueId,
        produto_id: line.produtoId,
        volume_atual: 0,
      });
    }
  }

  const { data: existentesDia, error: existErr } = await supabase
    .from("marcacao_tanques")
    .select(
      "id, tanque, produto, marcacao_inicial, entradas, saidas_ai, marcacao_final",
    )
    .eq("filial", args.filialId)
    .eq("data", dataIso);

  if (existErr) throw new Error(existErr.message);

  const existingByTanque = new Map<string, ExistingRow>();
  for (const e of existentesDia ?? []) {
    existingByTanque.set(String(e.tanque), {
      id: String(e.id),
      tanque: String(e.tanque),
      produto: e.produto != null ? String(e.produto) : null,
      marcacao_inicial: Number(e.marcacao_inicial) || 0,
      entradas: Number(e.entradas) || 0,
      saidas_ai: Number(e.saidas_ai) || 0,
      marcacao_final: Number(e.marcacao_final) || 0,
    });
  }

  // 1) Garante linha no dia para todos os tanques
  for (const t of lista) {
    if (existingByTanque.has(t.id)) continue;

    const prevFinal = await lastMarcacaoFinal(t.id, dataIso);
    const inicial = prevFinal != null ? prevFinal : t.volume_atual || 0;
    const entradaLine = byTanque.get(t.id);
    const entradas = entradaLine ? Number(entradaLine.litros) || 0 : 0;
    const saidas = 0;
    const final = calcMarcacaoFinal(inicial, entradas, saidas);

    const { data: inserted, error: insErr } = await supabase
      .from("marcacao_tanques")
      .insert({
        filial: args.filialId,
        data: dataIso,
        tanque: t.id,
        produto: entradaLine?.produtoId || t.produto_id,
        marcacao_inicial: inicial,
        entradas,
        saidas_ai: saidas,
        marcacao_final: final,
        variacao: calcVariacaoMarcacao(inicial, entradas, saidas, final),
      })
      .select(
        "id, tanque, produto, marcacao_inicial, entradas, saidas_ai, marcacao_final",
      )
      .single();

    if (insErr) throw new Error(insErr.message);

    existingByTanque.set(t.id, {
      id: String(inserted.id),
      tanque: String(inserted.tanque),
      produto: inserted.produto != null ? String(inserted.produto) : null,
      marcacao_inicial: Number(inserted.marcacao_inicial) || 0,
      entradas: Number(inserted.entradas) || 0,
      saidas_ai: Number(inserted.saidas_ai) || 0,
      marcacao_final: Number(inserted.marcacao_final) || 0,
    });

    // Já gravou a entrada na criação — não somar de novo abaixo
    if (entradaLine) byTanque.delete(t.id);
  }

  // 2) Atualiza entradas dos tanques da nota que já existiam no dia
  for (const line of byTanque.values()) {
    const existing = existingByTanque.get(line.tanqueId);
    if (!existing) continue;

    let entradas = existing.entradas;
    if (modo === "somar") {
      entradas = Number((existing.entradas + line.litros).toFixed(3));
    } else if (existing.entradas <= 0.0001) {
      // reparar: grava litros se ainda não havia entrada
      entradas = Number(line.litros.toFixed(3));
    } else {
      // já tem entrada: mantém valor e só recalcula final/variação
      entradas = existing.entradas;
    }

    const inicial = existing.marcacao_inicial;
    const saidas = existing.saidas_ai;
    // final = inicial + entradas − saídas
    const final = calcMarcacaoFinal(inicial, entradas, saidas);
    // variação = inicial + entradas − saídas − final
    const variacao = calcVariacaoMarcacao(inicial, entradas, saidas, final);

    const { error } = await supabase
      .from("marcacao_tanques")
      .update({
        entradas,
        marcacao_final: final,
        variacao,
        produto: line.produtoId || existing.produto || null,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
  }
}
