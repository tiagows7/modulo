import fs from "fs";
import pg from "pg";

const pwd = process.env.TARGET_DB_PASSWORD;
if (!pwd) {
  console.error("Defina TARGET_DB_PASSWORD");
  process.exit(1);
}

const sql = fs.readFileSync("scripts/53_filial_fiscal_nfe.sql", "utf8");
const c = new pg.Client({
  host: "aws-0-sa-east-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.rdtnlowhhtsickbgxzyu",
  password: pwd,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
await c.query(sql);
const cols = await c.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'filial'
    and (
      column_name like 'certificado%'
      or column_name like 'schemas%'
    )
  order by 1
`);
console.log("cols", cols.rows.map((r) => r.column_name));
const b = await c.query(
  `select id, public, file_size_limit from storage.buckets where id = 'filial-fiscal'`,
);
console.log("bucket", b.rows);
await c.end();
console.log("OK");
