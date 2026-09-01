/**
 * Testa conexão e lista tabelas do destino.
 * Uso: node scripts/backup/probe-target.mjs
 * Env: TARGET_SUPABASE_URL, TARGET_SUPABASE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_KEY;

if (!url || !key) {
  console.error("Defina TARGET_SUPABASE_URL e TARGET_SUPABASE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const res = await fetch(`${url}/rest/v1/`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/openapi+json",
  },
});

console.log("OpenAPI status:", res.status);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}

const spec = await res.json();
const tables = Object.keys(spec.paths || {})
  .map((p) => p.match(/^\/([a-zA-Z0-9_]+)$/))
  .filter(Boolean)
  .map((m) => m[1])
  .sort();

console.log("Tabelas no destino:", tables.length);
console.log(tables.join(", ") || "(nenhuma)");

const probe = ["filial", "produtos", "uf", "nota_entrada"];
for (const t of probe) {
  const { count, error } = await supabase
    .from(t)
    .select("*", { count: "exact", head: true });
  if (error) console.log(`  ${t}: ERRO ${error.message}`);
  else console.log(`  ${t}: ${count ?? 0} rows (leitura ok)`);
}
