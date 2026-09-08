import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return {};
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function ncmMatches(cestNcm, productNcm) {
  const c = digits(cestNcm);
  const n = digits(productNcm);
  if (!c || !n) return false;
  // CEST.ncm pode ser prefixo (ex.: 2710) ou NCM completo
  return n.startsWith(c) || c.startsWith(n.slice(0, Math.min(c.length, n.length)));
}

const env = { ...loadEnvLocal(), ...process.env };
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: produtos, error } = await sb
  .from("produtos")
  .select(
    "id, codigo, descricao, ncm_id, cest_id, anp_id, produto_ncm ( id, ibpt_ncm, ibpt_des )",
  )
  .order("codigo");
if (error) throw error;

const { data: cests, error: e2 } = await sb
  .from("produto_cest")
  .select("id, codigo, descricao, ncm")
  .order("codigo");
if (e2) throw e2;

console.log("produtos", (produtos || []).length, "cests", (cests || []).length);

function pickCest(ncmCode, descricao) {
  const n = digits(ncmCode);
  if (!n) return null;
  const matches = (cests || []).filter((c) => ncmMatches(c.ncm, n));
  if (!matches.length) return null;

  const desc = (descricao || "").toLowerCase();
  // Preferências por tipo de produto
  const prefer = (re) => matches.find((c) => re.test(`${c.descricao || ""} ${c.codigo}`));

  if (/gasolina|etanol|diesel|combust/.test(desc)) {
    return (
      prefer(/gasolina|etanol|diesel|combust|biocombust/i) ||
      matches[0]
    );
  }
  if (/refrigerante|guaran|cola|energ|bebida/.test(desc)) {
    return prefer(/refrigerante|bebida|água|agua|isotônic|energet/i) || matches[0];
  }
  if (/água|agua/.test(desc)) {
    return prefer(/água|agua|mineral/i) || matches[0];
  }
  if (/óleo|oleo|lubrific/.test(desc)) {
    return prefer(/óleo|oleo|lubrific/i) || matches[0];
  }
  if (/filtro/.test(desc)) {
    return prefer(/filtro/i) || matches[0];
  }
  if (/chocolate|salgad|café|cafe/.test(desc)) {
    return prefer(/chocolate|salgad|biscoito|café|cafe|aliment/i) || matches[0];
  }
  return matches[0];
}

let updated = 0;
let sem = [];
for (const p of produtos || []) {
  const ncmRel = Array.isArray(p.produto_ncm) ? p.produto_ncm[0] : p.produto_ncm;
  const ncmCode = ncmRel?.ibpt_ncm;
  const cest = pickCest(ncmCode, p.descricao);
  if (!cest) {
    sem.push({ codigo: p.codigo, descricao: p.descricao, ncm: ncmCode });
    continue;
  }
  if (p.cest_id === cest.id) {
    console.log("já ok", p.codigo, cest.codigo);
    continue;
  }
  const { error: upErr } = await sb
    .from("produtos")
    .update({ cest_id: cest.id })
    .eq("id", p.id);
  if (upErr) {
    console.error(p.codigo, upErr.message);
  } else {
    updated++;
    console.log(
      "ok",
      p.codigo,
      (p.descricao || "").slice(0, 26).padEnd(26),
      "NCM",
      ncmCode,
      "→ CEST",
      cest.codigo,
      (cest.descricao || "").slice(0, 50),
    );
  }
}

console.log("atualizados", updated, "sem cest", sem.length);
if (sem.length) console.log(sem);
