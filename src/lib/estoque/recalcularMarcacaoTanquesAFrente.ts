import { supabase } from "@/lib/supabase";
import {
  calcMarcacaoFinal,
  calcVariacaoMarcacao,
} from "@/lib/estoque/marcacaoTanqueMath";

const EPS = 0.001;

function nearlyEqual(a: number, b: number) {
  return Math.abs(a - b) <= EPS;
}

/**
 * Após alterar a marcação do dia `afterDate` (nota lançada ou medição),
 * propaga o final → inicial dos dias seguintes do(s) tanque(s).
 *
 * - Dias com final “automático” (final ≈ inicial+entradas−saídas): recalcula o final.
 * - Dias com medição manual (variação ≠ 0): mantém o final medido e só recalcula a variação.
 * - Atualiza `tanques.volume_atual` com o último final da cadeia.
 */
export async function recalcularMarcacaoTanquesAFrente(args: {
  filialId: string;
  /** Dia que acabou de ser alterado (AAAA-MM-DD). Ajusta movimentos com data > afterDate. */
  afterDate: string;
  /** Se omitido, recalcula todos os tanques com movimento futuro na filial. */
  tanqueIds?: string[];
}) {
  const afterDate = String(args.afterDate || "").slice(0, 10);
  if (!args.filialId || !/^\d{4}-\d{2}-\d{2}$/.test(afterDate)) {
    throw new Error("Filial e data são obrigatórias para recalcular o movimento.");
  }

  let tanqueIds = (args.tanqueIds ?? [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  if (!tanqueIds.length) {
    const { data: futuros, error } = await supabase
      .from("marcacao_tanques")
      .select("tanque")
      .eq("filial", args.filialId)
      .gt("data", afterDate);
    if (error) throw new Error(error.message);
    tanqueIds = [
      ...new Set((futuros ?? []).map((r) => String(r.tanque))),
    ];
  }

  if (!tanqueIds.length) return { atualizados: 0 };

  let atualizados = 0;

  for (const tanqueId of tanqueIds) {
    const { data: seedRow, error: seedErr } = await supabase
      .from("marcacao_tanques")
      .select("marcacao_final")
      .eq("filial", args.filialId)
      .eq("tanque", tanqueId)
      .eq("data", afterDate)
      .maybeSingle();
    if (seedErr) throw new Error(seedErr.message);

    let prevFinal: number | null =
      seedRow?.marcacao_final != null
        ? Number(seedRow.marcacao_final) || 0
        : null;

    if (prevFinal == null) {
      const { data: prev, error: prevErr } = await supabase
        .from("marcacao_tanques")
        .select("marcacao_final")
        .eq("filial", args.filialId)
        .eq("tanque", tanqueId)
        .lte("data", afterDate)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevErr) throw new Error(prevErr.message);
      if (prev?.marcacao_final != null) {
        prevFinal = Number(prev.marcacao_final) || 0;
      }
    }

    if (prevFinal == null) {
      const { data: tanque } = await supabase
        .from("tanques")
        .select("volume_atual")
        .eq("id", tanqueId)
        .maybeSingle();
      prevFinal = tanque?.volume_atual != null ? Number(tanque.volume_atual) || 0 : 0;
    }

    const { data: futuros, error: futErr } = await supabase
      .from("marcacao_tanques")
      .select(
        "id, data, marcacao_inicial, entradas, saidas_ai, marcacao_final, variacao",
      )
      .eq("filial", args.filialId)
      .eq("tanque", tanqueId)
      .gt("data", afterDate)
      .order("data", { ascending: true });

    if (futErr) throw new Error(futErr.message);

    let cursor = prevFinal;

    for (const row of futuros ?? []) {
      const id = String(row.id);
      const inicialAtual = Number(row.marcacao_inicial) || 0;
      const entradas = Number(row.entradas) || 0;
      const saidas = Number(row.saidas_ai) || 0;
      const finalAtual = Number(row.marcacao_final) || 0;

      const teoricoAntigo = calcMarcacaoFinal(inicialAtual, entradas, saidas);
      const eraAutomatico = nearlyEqual(finalAtual, teoricoAntigo);

      const novoInicial = cursor;
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
        !nearlyEqual(novaVariacao, Number(row.variacao) || 0);

      if (mudou) {
        const { error: updErr } = await supabase
          .from("marcacao_tanques")
          .update({
            marcacao_inicial: novoInicial,
            marcacao_final: novoFinal,
            variacao: novaVariacao,
          })
          .eq("id", id);
        if (updErr) throw new Error(updErr.message);
        atualizados += 1;
      }

      cursor = novoFinal;
    }

    // Volume atual do tanque = último final conhecido (seed ou último dia futuro)
    const { error: volErr } = await supabase
      .from("tanques")
      .update({ volume_atual: cursor })
      .eq("id", tanqueId);
    if (volErr) throw new Error(volErr.message);
  }

  return { atualizados };
}
