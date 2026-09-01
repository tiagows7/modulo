/**
 * Importa backup JSON para um Supabase de destino.
 *
 * Uso:
 *   set TARGET_SUPABASE_URL=https://xxx.supabase.co
 *   set TARGET_SUPABASE_KEY=<service_role>
 *   node scripts/backup/import-backup.mjs [pasta-do-backup]
 *
 * Default backup: backups/full-2026-08-31T22-14-26
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const url = process.env.TARGET_SUPABASE_URL;
const key = process.env.TARGET_SUPABASE_KEY;
const backupArg = process.argv[2];
const backupDir = path.resolve(
  root,
  backupArg || "backups/full-2026-08-31T22-14-26",
);

if (!url || !key) {
  console.error("Defina TARGET_SUPABASE_URL e TARGET_SUPABASE_KEY (service_role)");
  process.exit(1);
}

const manifestPath = path.join(backupDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json não encontrado em", backupDir);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 200;

async function upsertBatch(table, rows) {
  // tenta insert; se falhar por conflito, tenta upsert genérico
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      // retry com upsert em id se existir
      const hasId = chunk[0] && Object.prototype.hasOwnProperty.call(chunk[0], "id");
      if (hasId) {
        const { error: e2 } = await supabase
          .from(table)
          .upsert(chunk, { onConflict: "id" });
        if (e2) throw new Error(`${table} batch ${i}: ${e2.message}`);
      } else {
        throw new Error(`${table} batch ${i}: ${error.message}`);
      }
    }
  }
}

async function tableExists(table) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (!error) return true;
  if (/schema cache|does not exist|not find/i.test(error.message)) return false;
  // outros erros (vazio etc.) = tabela existe
  return true;
}

async function main() {
  console.log("Destino:", url);
  console.log("Backup:", backupDir);
  console.log("Tabelas no manifest:", manifest.tables?.length || 0);

  // smoke: uf precisa existir
  if (!(await tableExists("uf"))) {
    console.error(
      "\nSchema não encontrado no destino.\n" +
        "1) Rode: npm run db:schema\n" +
        "2) No SQL Editor do projeto novo, execute o arquivo:\n" +
        "   scripts/rebuild/ALL_SCHEMA.sql\n" +
        "3) Rode este import de novo.\n",
    );
    process.exit(2);
  }

  const results = [];
  for (const entry of manifest.tables || []) {
    const table = entry.table;
    const jsonRel = entry.json || `json/${table}.json`;
    // backup antigo usava data/ ; full usa json/
    let file = path.join(backupDir, jsonRel);
    if (!fs.existsSync(file)) {
      file = path.join(backupDir, "data", `${table}.json`);
    }
    if (!fs.existsSync(file)) {
      file = path.join(backupDir, "json", `${table}.json`);
    }
    if (!fs.existsSync(file)) {
      console.log(`  ${table}: SKIP (arquivo ausente)`);
      results.push({ table, status: "skip-file" });
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(rows) || !rows.length) {
      console.log(`  ${table}: 0 rows`);
      results.push({ table, status: "empty", rows: 0 });
      continue;
    }

    process.stdout.write(`  ${table}: ${rows.length}... `);
    try {
      if (!(await tableExists(table))) {
        console.log("SKIP (tabela inexistente)");
        results.push({ table, status: "skip-table", rows: rows.length });
        continue;
      }
      await upsertBatch(table, rows);
      console.log("OK");
      results.push({ table, status: "ok", rows: rows.length });
    } catch (e) {
      console.log("ERRO", e.message);
      results.push({ table, status: "error", error: e.message, rows: rows.length });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const err = results.filter((r) => r.status === "error");
  console.log("\n========== IMPORT ==========");
  console.log(`OK: ${ok}`);
  console.log(`Erros: ${err.length}`);
  if (err.length) {
    for (const e of err) console.log(`  - ${e.table}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
