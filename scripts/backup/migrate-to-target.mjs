/**
 * Aplica schema + importa backup via Postgres (postgres role).
 * Env: TARGET_SUPABASE_URL, TARGET_DB_PASSWORD, TARGET_RESET_SCHEMA=1
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const url = process.env.TARGET_SUPABASE_URL || "";
const backupDir = path.resolve(
  root,
  process.argv[2] || "backups/full-2026-08-31T22-14-26",
);

function refFromUrl(u) {
  try {
    return new URL(u).hostname.split(".")[0];
  } catch {
    return null;
  }
}

function buildClient() {
  const password = process.env.TARGET_DB_PASSWORD;
  const ref = refFromUrl(url);
  if (!password || !ref) throw new Error("Falta TARGET_DB_PASSWORD / URL");
  return new pg.Client({
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
}

async function applyScripts(client) {
  spawnSync("node", ["scripts/rebuild/concat-schema.mjs"], {
    cwd: root,
    shell: true,
  });
  const order = fs
    .readFileSync(path.join(root, "scripts/rebuild/ORDER.txt"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const seedFiles = new Set([
    "12_produtos_combustiveis.sql",
    "20_produto_piscofins_seed.sql",
    "22_categorias_icm_seed.sql",
    "44_seed_produtos_pdv_teste.sql",
  ]);

  for (const name of order) {
    const file = path.join(root, "scripts", name);
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, "utf8");
    process.stdout.write(`DDL ${name} ... `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (e) {
      const msg = e.message || "";
      if (seedFiles.has(name) || /already exists/i.test(msg)) {
        console.log("SKIP:", msg.split("\n")[0]);
        continue;
      }
      console.log("FAIL");
      throw new Error(`${name}: ${msg}`);
    }
  }

  await client.query(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  `);
  console.log("GRANTs OK");
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function importTable(client, table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");

  // limpa dados seed/anteriores da tabela
  await client.query(`TRUNCATE TABLE public."${table}" CASCADE`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = slice
      .map((row) => `(${cols.map((c) => sqlLiteral(row[c])).join(", ")})`)
      .join(",\n");
    await client.query(
      `INSERT INTO public."${table}" (${colList}) VALUES ${values}`,
    );
  }

  // ajusta sequence se tiver id numérico
  if (cols.includes("id") && typeof rows[0].id === "number") {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('public."${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM public."${table}"), 1),
        true
      )
    `).catch(() => {});
  }
}

async function main() {
  const client = buildClient();
  await client.connect();
  console.log("Postgres conectado");

  if (process.env.TARGET_RESET_SCHEMA === "1") {
    console.log("RESET schema public…");
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    `);
  }

  console.log("Aplicando schema…");
  await applyScripts(client);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8"),
  );

  console.log("\nImportando dados…");

  // Monta lista de arquivos existentes
  const loads = [];
  for (const entry of manifest.tables || []) {
    const table = entry.table;
    let file = path.join(backupDir, entry.json || `json/${table}.json`);
    if (!fs.existsSync(file)) file = path.join(backupDir, "json", `${table}.json`);
    if (!fs.existsSync(file)) continue;
    const rows = JSON.parse(fs.readFileSync(file, "utf8"));
    const reg = await client.query(`SELECT to_regclass($1) t`, [`public.${table}`]);
    if (!reg.rows[0]?.t) continue;
    loads.push({ table, rows });
  }

  if (loads.length) {
    const names = loads.map((l) => `public."${l.table}"`).join(", ");
    console.log("TRUNCATE all…");
    await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }

  try {
    await client.query("SET session_replication_role = replica");
  } catch {
    console.log("(session_replication_role indisponível — seguindo sem)");
  }

  const errors = [];
  for (const { table, rows } of loads) {
    process.stdout.write(`  ${table}: ${rows.length}… `);
    try {
      if (!rows.length) {
        console.log("0");
        continue;
      }
      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const BATCH = 80;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const values = slice
          .map((row) => `(${cols.map((c) => sqlLiteral(row[c])).join(", ")})`)
          .join(",\n");
        await client.query(
          `INSERT INTO public."${table}" (${colList}) VALUES ${values}`,
        );
      }
      if (cols.includes("id") && typeof rows[0].id === "number") {
        await client
          .query(
            `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'), COALESCE((SELECT MAX(id)::bigint FROM public."${table}"), 1), true)`,
          )
          .catch(() => {});
      }
      console.log("OK");
    } catch (e) {
      console.log("ERRO", e.message.split("\n")[0]);
      errors.push({ table, error: e.message });
    }
  }

  try {
    await client.query("SET session_replication_role = DEFAULT");
  } catch {}
  await client.end();

  console.log("\n========== RESULTADO ==========");
  console.log("Erros:", errors.length);
  if (errors.length) {
    for (const e of errors) console.log(" -", e.table, e.error.split("\n")[0]);
    process.exit(1);
  }
  console.log("Migração concluída com sucesso.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
