/**
 * Concatena todos os scripts SQL na ordem de ORDER.txt
 * em scripts/rebuild/ALL_SCHEMA.sql (pronto para colar no SQL Editor).
 *
 * Uso: node scripts/rebuild/concat-schema.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const orderFile = path.join(__dirname, "ORDER.txt");
const scriptsDir = path.join(root, "scripts");
const outFile = path.join(__dirname, "ALL_SCHEMA.sql");

const lines = fs
  .readFileSync(orderFile, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const parts = [
  "-- =============================================================================",
  "-- ALL_SCHEMA.sql — gerado automaticamente",
  `-- Gerado em: ${new Date().toISOString()}`,
  "-- Aplique no SQL Editor do Supabase após criar o projeto (schema public).",
  "-- =============================================================================",
  "",
];

for (const name of lines) {
  const file = path.join(scriptsDir, name);
  if (!fs.existsSync(file)) {
    parts.push(`-- MISSING: ${name}`);
    console.warn("missing", name);
    continue;
  }
  parts.push(`-- >>> BEGIN ${name}`);
  parts.push(fs.readFileSync(file, "utf8").trimEnd());
  parts.push(`-- <<< END ${name}`);
  parts.push("");
  console.log("ok", name);
}

fs.writeFileSync(outFile, parts.join("\n") + "\n", "utf8");
console.log("\nGerado:", outFile);
