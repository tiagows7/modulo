import fs from "fs";
import path from "path";
import pg from "pg";

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
const pwd = env.TARGET_DB_PASSWORD || env.SUPABASE_DB_PASSWORD;
const databaseUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;

const sql = fs.readFileSync("scripts/61_filial_token_nfce.sql", "utf8");

let client;
if (databaseUrl) {
  client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
} else if (pwd) {
  client = new pg.Client({
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.rdtnlowhhtsickbgxzyu",
    password: pwd,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
} else {
  console.error("Defina DATABASE_URL ou TARGET_DB_PASSWORD no .env.local");
  process.exit(1);
}

await client.connect();
await client.query(sql);
const cols = await client.query(`
  select column_name, data_type, character_maximum_length
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'filial'
    and column_name in ('token_id', 'token_nfce')
  order by 1
`);
console.log(cols.rows);
await client.end();
console.log("OK 61_filial_token_nfce");
