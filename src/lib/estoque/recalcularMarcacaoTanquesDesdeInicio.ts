import { supabase } from "@/lib/supabase";
import {
  calcMarcacaoFinal,
  calcVariacaoMarcacao,
} from "@/lib/estoque/marcacaoTanqueMath";

const EPS = 0.001;

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= EPS;
}

type MarcacaoRow = {
  id: string;
  filial: string | null;
  data: string;
  tanque: string;
  marcacao_inicial: number;
  entradas: number;
  saidas_ai: number;
  marcacao_final: number;
  variacao: number;
};

/**
 * Recalcula toda a cadeia de `marcacao_tanques` desde o primeiro dia.
 * - 1º dia: mantém o inicial gravado; ajusta final (se automático) e variação.
 * - Dias seguintes: inicial = final do dia anterior; mesma regra de final/variação.
 * - Atualiza `tanques.volume_atual` com o último final.
 */
export async function recalcularMarcacaoTanquesDesdeInicio(args?: {
  filialId?: string | null;
  tanqueIds?: string[];
}) {
  const filialId = args?.filialId ? String(args.filialId).trim() : "";
  const filterTanques = new Set(
    (args?.tanqueIds ?? []).map((id) => String(id || "").trim()).filter(Boolean),
  );

  const pageSize = 1000;
  const rows: MarcacaoRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("marcacao_tanques")
      .select(
        "id, filial, data, tanque, marcacao_inicial, entradas, saidas_ai, marcacao_final, variacao",
      )
      .order("data", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (filialId) q = q.eq("filial", filialId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const r of batch) {
      const tanque = String(r.tanque);
      if (filterTanques.size && !filterTanques.has(tanque)) continue;
      rows.push({
        id: String(r.id),
        filial: r.filial != null ? String(r.filial) : null,
        data: String(r.data).slice(0, 10),
        tanque,
        marcacao_inicial: Number(r.marcacao_inicial) || 0,
        entradas: Number(r.entradas) || 0,
        saidas_ai: Number(r.saidas_ai) || 0,
        marcacao_final: Number(r.marcacao_final) || 0,
        variacao: Number(r.variacao) || 0,
      });
    }
    if (batch.length < pageSize) break;
  }

  const byTanque = new Map<string, MarcacaoRow[]>();
  for (const row of rows) {
    const key = `${row.filial || ""}|${row.tanque}`;
    const list = byTanque.get(key) ?? [];
    list.push(row);
    byTanque.set(key, list);
  }

  let atualizados = 0;
  let tanquesOk = 0;

  for (const [, chain] of byTanque) {
    if (!chain.length) continue;
    chain.sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? -1 : 1;
      return 0;
    });

    let cursor: number | null = null;
    let lastFinal = 0;
    const tanqueId = chain[0].tanque;

    for (let i = 0; i < chain.length; i++) {
      const row = chain[i];
      const inicialAtual = row.marcacao_inicial;
      const entradas = row.entradas;
      const saidas = row.saidas_ai;
      const finalAtual = row.marcacao_final;

      const teoricoAntigo = calcMarcacaoFinal(inicialAtual, entradas, saidas);
      const eraAutomatico = nearlyEqual(finalAtual, teoricoAntigo);

      const novoInicial = i === 0 ? inicialAtual : (cursor as number);
      let novoFinal = finalAtual;
      if (eraAutomatico) {
        novoFinal = calcMarcacaoFinal(novoInicial, entradas, saidas);
      }
      const novaVariacao = calcVariacaoMarcacao(
        novoInicial,
        entradas,
        saidas,
        novoFinal,
      );

      const mudou =
        !nearlyEqual(novoInicial, inicialAtual) ||
        !nearlyEqual(novoFinal, finalAtual) ||
        !nearlyEqual(novaVariacao, row.variacao);

      if (mudou) {
        const { error } = await supabase
          .from("marcacao_tanques")
          .update({
            marcacao_inicial: novoInicial,
            marcacao_final: novoFinal,
            variacao: novaVariacao,
          })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        atualizados += 1;
      }

      cursor = novoFinal;
      lastFinal = novoFinal;
    }

    const { error: volErr } = await supabase
      .from("tanques")
      .update({ volume_atual: lastFinal })
      .eq("id", tanqueId);
    if (volErr) throw new Error(volErr.message);
    tanquesOk += 1;
  }

  return {
    cadeias: byTanque.size,
    registros: rows.length,
    atualizados,
    tanques: tanquesOk,
  };
}
