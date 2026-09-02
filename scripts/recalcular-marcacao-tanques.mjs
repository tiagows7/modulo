/**
 * Recalcula public.marcacao_tanques desde o primeiro dia de cada tanque.
 *
 * Uso:
 *   node scripts/recalcular-marcacao-tanques.mjs
 *   node scripts/recalcular-marcacao-tanques.mjs --filial=<uuid>
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local",
  );
  process.exit(1);
}

const filialArg = process.argv
  .find((a) => a.startsWith("--filial="))
  ?.slice("--filial=".length);

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EPS = 0.001;
const nearlyEqual = (a, b) => Math.abs(a - b) <= EPS;
const calcFinal = (i, e, s) => Number((i + e - s).toFixed(3));
const calcVar = (i, e, s, f) => Number((i + e - s - f).toFixed(3));

async function loadAllRows(filialId) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase
      .from("marcacao_tanques")
      .select(
        "id, filial, data, tanque, marcacao_inicial, entradas, saidas_ai, marcacao_final, variacao, created_at",
      )
      .order("data", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (filialId) q = q.eq("filial", filialId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function main() {
  console.log(
    filialArg
      ? `Recalculando marcacao_tanques da filial ${filialArg}…`
      : "Recalculando marcacao_tanques de todas as filiais…",
  );

  const raw = await loadAllRows(filialArg || null);
  console.log(`Registros lidos: ${raw.length}`);

  const byTanque = new Map();
  for (const r of raw) {
    const key = `${r.filial || ""}|${r.tanque}`;
    if (!byTanque.has(key)) byTanque.set(key, []);
    byTanque.get(key).push(r);
  }

  let atualizados = 0;
  let tanques = 0;

  for (const [, chain] of byTanque) {
    chain.sort((a, b) => {
      if (a.data !== b.data) return String(a.data) < String(b.data) ? -1 : 1;
      return String(a.created_at || "") < String(b.created_at || "") ? -1 : 1;
    });

    let cursor = null;
    let lastFinal = 0;
    const tanqueId = String(chain[0].tanque);

    for (let i = 0; i < chain.length; i++) {
      const row = chain[i];
      const inicialAtual = Number(row.marcacao_inicial) || 0;
      const entradas = Number(row.entradas) || 0;
      const saidas = Number(row.saidas_ai) || 0;
      const finalAtual = Number(row.marcacao_final) || 0;

      const teoricoAntigo = calcFinal(inicialAtual, entradas, saidas);
      const eraAutomatico = nearlyEqual(finalAtual, teoricoAntigo);

      const novoInicial = i === 0 ? inicialAtual : cursor;
      let novoFinal = finalAtual;
      if (eraAutomatico) novoFinal = calcFinal(novoInicial, entradas, saidas);
      const novaVariacao = calcVar(novoInicial, entradas, saidas, novoFinal);

      const mudou =
        !nearlyEqual(novoInicial, inicialAtual) ||
        !nearlyEqual(novoFinal, finalAtual) ||
        !nearlyEqual(novaVariacao, Number(row.variacao) || 0);

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
    tanques += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        cadeias: byTanque.size,
        registros: raw.length,
        atualizados,
        tanques,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
