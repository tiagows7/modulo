/**
 * Backup completo dos dados do schema public (Supabase).
 * Uso: node scripts/backup/export-backup.mjs
 *
 * Descobre tabelas via OpenAPI do PostgREST e exporta JSON + SQL INSERT.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function loadEnv(file) {
  const out = {};
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local",
  );
  process.exit(1);
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "AVISO: sem SERVICE_ROLE — RLS pode omitir linhas. Preferível usar SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE = 1000;

/** Ordem preferencial (FKs); o restante entra no final em ordem alfabética. */
const PREFERRED_ORDER = [
  "uf",
  "cidades",
  "filial",
  "unidade_medida",
  "categorias_icm",
  "produto_cfop",
  "produto_ncm",
  "produto_cest",
  "produto_anp",
  "produto_piscofins",
  "produto_ipi",
  "produto_ibscbs_cst",
  "produto_ibscbs_classtrib",
  "produto_grupocomissao",
  "grupo_produtos",
  "subgrupo_produtos",
  "fornecedores",
  "clientes",
  "documentos_caixa",
  "veiculos",
  "funcionarios",
  "produtos",
  "produto_filial",
  "grupo_precos",
  "grupo_precos_itens",
  "tanques",
  "bicos",
  "abastecimentos",
  "marcacao_bombas",
  "marcacao_tanques",
  "nota_entrada",
  "nota_entradaprodutos",
  "nota_entradamanifesto",
  "nota_xmlproduto",
  "contas_pagar",
  "contas_pagarpagamento",
];

async function discoverTables() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao listar tabelas (OpenAPI): HTTP ${res.status}`);
  }
  const spec = await res.json();
  const paths = Object.keys(spec.paths || {});
  const tables = new Set();
  for (const p of paths) {
    // "/tabela" ou "/tabela/{id}"
    const m = p.match(/^\/([a-zA-Z0-9_]+)$/);
    if (m) tables.add(m[1]);
  }
  return [...tables];
}

function sortTables(tables) {
  const set = new Set(tables);
  const ordered = [];
  for (const t of PREFERRED_ORDER) {
    if (set.has(t)) {
      ordered.push(t);
      set.delete(t);
    }
  }
  ordered.push(...[...set].sort());
  return ordered;
}

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, to);
    if (error) return { ok: false, error: error.message, rows: [] };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return { ok: true, error: null, rows };
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

function rowsToSql(table, rows) {
  if (!rows.length) {
    return `-- ${table}: 0 rows\n`;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const lines = [
    `-- ${table}: ${rows.length} rows`,
    `TRUNCATE TABLE public."${table}" CASCADE;`,
  ];
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = slice
      .map(
        (row) =>
          `(${cols.map((c) => sqlLiteral(row[c])).join(", ")})`,
      )
      .join(",\n  ");
    lines.push(
      `INSERT INTO public."${table}" (${colList}) VALUES\n  ${values};`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(root, "backups", `full-${stamp}`);
  const jsonDir = path.join(outDir, "json");
  const sqlDir = path.join(outDir, "sql");
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.mkdirSync(sqlDir, { recursive: true });

  console.log("Descobrindo tabelas…");
  const discovered = await discoverTables();
  const tables = sortTables(discovered);
  console.log(`Encontradas: ${tables.length}`);
  console.log(`Backup → ${outDir}\n`);

  const manifest = {
    created_at: new Date().toISOString(),
    supabase_host: new URL(url).host,
    type: "full-data-backup",
    tables: [],
    errors: [],
  };

  const sqlParts = [
    "-- Backup completo de DADOS (gerado automaticamente)",
    `-- ${manifest.created_at}`,
    `-- host: ${manifest.supabase_host}`,
    "-- Aplique DEPOIS do schema (ALL_SCHEMA.sql).",
    "-- Desabilita triggers de FK temporariamente se necessário.",
    "BEGIN;",
    "",
  ];

  for (const table of tables) {
    process.stdout.write(`  ${table}... `);
    const res = await fetchAll(table);
    if (!res.ok) {
      console.log(`ERRO: ${res.error}`);
      manifest.errors.push({ table, error: res.error });
      continue;
    }

    fs.writeFileSync(
      path.join(jsonDir, `${table}.json`),
      JSON.stringify(res.rows, null, 2),
      "utf8",
    );

    const sql = rowsToSql(table, res.rows);
    fs.writeFileSync(path.join(sqlDir, `${table}.sql`), sql, "utf8");
    sqlParts.push(sql);

    console.log(`${res.rows.length} rows`);
    manifest.tables.push({
      table,
      rows: res.rows.length,
      json: `json/${table}.json`,
      sql: `sql/${table}.sql`,
    });
  }

  sqlParts.push("COMMIT;", "");

  fs.writeFileSync(
    path.join(outDir, "ALL_DATA.sql"),
    sqlParts.join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "README.txt"),
    [
      "BACKUP COMPLETO DE DADOS",
      `Criado em: ${manifest.created_at}`,
      `Host: ${manifest.supabase_host}`,
      "",
      "Conteúdo:",
      "- json/          → um arquivo por tabela",
      "- sql/           → INSERTs por tabela",
      "- ALL_DATA.sql   → tudo em um arquivo",
      "- manifest.json  → contagens",
      "",
      "NÃO inclui:",
      "- Schema (use npm run db:schema → ALL_SCHEMA.sql)",
      "- auth.users / storage (Dashboard Supabase)",
      "",
      "Restaurar:",
      "1) Novo projeto → rodar schema",
      "2) SQL Editor → ALL_DATA.sql",
      "",
    ].join("\n"),
    "utf8",
  );

  const totalRows = manifest.tables.reduce((a, t) => a + t.rows, 0);
  console.log("\n========== BACKUP COMPLETO ==========");
  console.log(`Pasta:   ${outDir}`);
  console.log(`Tabelas: ${manifest.tables.length}`);
  console.log(`Linhas:  ${totalRows}`);
  console.log(`Erros:   ${manifest.errors.length}`);
  console.log(`SQL:     ${path.join(outDir, "ALL_DATA.sql")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
