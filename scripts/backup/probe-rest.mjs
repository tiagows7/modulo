import { createClient } from "@supabase/supabase-js";

const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_KEY;
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const t of ["filial", "produtos", "uf"]) {
  const { data, error, count } = await supabase
    .from(t)
    .select("*", { count: "exact", head: true });
  console.log(t, error ? `ERRO: ${error.message}` : `ok count=${count}`);
}

const { data: ins, error: ie } = await supabase
  .from("uf")
  .insert({ codigo: "__probe__", nome: "probe" })
  .select();
console.log("insert uf:", ie ? `ERRO: ${ie.message}` : "ok", ins);
if (!ie && ins?.[0]) {
  await supabase.from("uf").delete().eq("codigo", "__probe__");
  console.log("cleanup ok");
}
