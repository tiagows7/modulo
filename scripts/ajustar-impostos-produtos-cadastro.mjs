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

const env = { ...loadEnvLocal(), ...process.env };
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function byCodigo(table, codigo, col = "codigo") {
  const { data, error } = await sb
    .from(table)
    .select("id, codigo")
    .eq(col, codigo)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function ncmByCode(ncmDigits) {
  const digits = String(ncmDigits).replace(/\D/g, "");
  // ibpt_ncm pode ser number
  const asNum = Number(digits);
  const { data } = await sb
    .from("produto_ncm")
    .select("id, ibpt_ncm, ibpt_des")
    .eq("ibpt_ncm", asNum)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: d2 } = await sb
    .from("produto_ncm")
    .select("id, ibpt_ncm, ibpt_des")
    .ilike("ibpt_ncm", `${digits}%`)
    .limit(1)
    .maybeSingle();
  return d2?.id || null;
}

async function anpByCode(codigo) {
  const { data } = await sb
    .from("produto_anp")
    .select("id")
    .eq("codigo", codigo)
    .maybeSingle();
  return data?.id || null;
}

const icmComb = await byCodigo("categorias_icm", 10);
const icmSimples = await byCodigo("categorias_icm", 11);
const icmSt = await byCodigo("categorias_icm", 13);
const cfopComb = await byCodigo("produto_cfop", "5656");
const cfopMerc = await byCodigo("produto_cfop", "5102");
const cfopSt = await byCodigo("produto_cfop", "5405");
const pisMono = await byCodigo("produto_piscofins", "04");
const pisBasico = await byCodigo("produto_piscofins", "01");
const ipiNt = await byCodigo("produto_ipi", "53");

console.log({
  icmComb,
  icmSimples,
  icmSt,
  cfopComb,
  cfopMerc,
  cfopSt,
  pisMono,
  pisBasico,
  ipiNt,
});

// NCM tipicos (8 digitos)
const NCM = {
  gasolina: await ncmByCode("27101259"),
  etanol: await ncmByCode("22071090"),
  diesel: await ncmByCode("27101921"),
  agua: await ncmByCode("22011000"),
  refri: await ncmByCode("22021000"),
  energetico: await ncmByCode("22029900"),
  cafe: await ncmByCode("21011100"),
  chocolate: await ncmByCode("18069000"),
  salgado: await ncmByCode("19059090"),
  oleo: await ncmByCode("27101932"),
  aditivo: await ncmByCode("38200000"),
  filtro: await ncmByCode("84213100"),
};
console.log("ncm ids", NCM);

const ANP = {
  gasolinaComum: await anpByCode("210203001"),
  gasolinaAdit: await anpByCode("210203002"),
  etanol: await anpByCode("220101002"),
  dieselS10: await anpByCode("820101012"),
  dieselS500: await anpByCode("820101033"),
};
// fallback diesel S500 codes
if (!ANP.dieselS500) {
  const { data } = await sb
    .from("produto_anp")
    .select("id, codigo, descricao")
    .ilike("descricao", "%S500%")
    .limit(5);
  console.log("diesel S500 candidates", data);
  ANP.dieselS500 = data?.[0]?.id || null;
}
console.log("anp ids", ANP);

/** @type {Record<string, object>} */
const mapByCodigo = {
  "1": {
    // Gasolina Comum
    categoria_icm_id: icmComb,
    cfop_id: cfopComb,
    piscofins_id: pisMono,
    ipi_id: ipiNt,
    ncm_id: NCM.gasolina,
    anp_id: ANP.gasolinaComum,
  },
  "2": {
    categoria_icm_id: icmComb,
    cfop_id: cfopComb,
    piscofins_id: pisMono,
    ipi_id: ipiNt,
    ncm_id: NCM.gasolina,
    anp_id: ANP.gasolinaAdit,
  },
  "3": {
    categoria_icm_id: icmComb,
    cfop_id: cfopComb,
    piscofins_id: pisMono,
    ipi_id: ipiNt,
    ncm_id: NCM.etanol,
    anp_id: ANP.etanol,
  },
  "4": {
    categoria_icm_id: icmComb,
    cfop_id: cfopComb,
    piscofins_id: pisMono,
    ipi_id: ipiNt,
    ncm_id: NCM.diesel,
    anp_id: ANP.dieselS10,
  },
  "5": {
    categoria_icm_id: icmComb,
    cfop_id: cfopComb,
    piscofins_id: pisMono,
    ipi_id: ipiNt,
    ncm_id: NCM.diesel,
    anp_id: ANP.dieselS500,
  },
  "10": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.agua,
  },
  "11": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.agua,
  },
  "12": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.refri,
  },
  "13": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.refri,
  },
  "14": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.energetico,
  },
  "15": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.cafe,
  },
  "16": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.chocolate,
  },
  "17": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.salgado,
  },
  "20": {
    categoria_icm_id: icmSt,
    cfop_id: cfopSt,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.oleo,
  },
  "21": {
    categoria_icm_id: icmSt,
    cfop_id: cfopSt,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.oleo,
  },
  "22": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.aditivo,
  },
  "30": {
    categoria_icm_id: icmSimples,
    cfop_id: cfopMerc,
    piscofins_id: pisBasico,
    ipi_id: ipiNt,
    ncm_id: NCM.filtro,
  },
};

const { data: produtos, error } = await sb
  .from("produtos")
  .select("id, codigo, descricao")
  .order("codigo");
if (error) throw error;

let updated = 0;
let skipped = 0;
for (const p of produtos || []) {
  const patch = mapByCodigo[String(p.codigo)];
  if (!patch) {
    // default loja
    const def = {
      categoria_icm_id: icmSimples,
      cfop_id: cfopMerc,
      piscofins_id: pisBasico,
      ipi_id: ipiNt,
    };
    const { error: e2 } = await sb.from("produtos").update(def).eq("id", p.id);
    if (e2) console.error(p.codigo, e2.message);
    else {
      updated++;
      console.log("default", p.codigo, p.descricao);
    }
    continue;
  }
  const { error: e3 } = await sb.from("produtos").update(patch).eq("id", p.id);
  if (e3) {
    console.error(p.codigo, e3.message);
    skipped++;
  } else {
    updated++;
    console.log(
      "ok",
      p.codigo,
      p.descricao,
      "ncm=",
      !!patch.ncm_id,
      "anp=",
      !!patch.anp_id,
    );
  }
}

const { data: check } = await sb
  .from("produtos")
  .select("codigo, categoria_icm_id, cfop_id, ncm_id, piscofins_id, ipi_id, anp_id");
const still = (check || []).filter(
  (r) => !r.categoria_icm_id || !r.cfop_id || !r.piscofins_id || !r.ipi_id,
);
console.log("updated", updated, "errors", skipped, "still incomplete", still.length);
console.log(
  "sem ncm",
  (check || []).filter((r) => !r.ncm_id).map((r) => r.codigo),
);
