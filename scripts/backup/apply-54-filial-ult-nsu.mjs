import fs from "fs";
import pg from "pg";

const pwd = process.env.TARGET_DB_PASSWORD;
if (!pwd) {
  console.error("Defina TARGET_DB_PASSWORD");
  process.exit(1);
}

const sql = fs.readFileSync("scripts/54_filial_ult_nsu.sql", "utf8");
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
const rows = await c.query(
  `select codigo, ult_nsu from public.filial order by codigo`,
);
console.log(rows.rows);
await c.end();
console.log("OK");
