import pg from "pg";

const pwd = process.env.TARGET_DB_PASSWORD;
if (!pwd) {
  console.error("Defina TARGET_DB_PASSWORD");
  process.exit(1);
}

const c = new pg.Client({
  host: "aws-0-sa-east-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.rdtnlowhhtsickbgxzyu",
  password: pwd,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

await c.query(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polname LIKE 'Permitir acesso autenticado%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      r.polname, r.table_name
    );
  END LOOP;
END $$;
`);

const sample = await c.query(`
  select c.relname, p.polname,
         pg_get_expr(p.polqual, p.polrelid) as using_expr,
         pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('nota_entrada','nota_entradaprodutos','marcacao_tanques','contas_pagar')
  order by 1,2
`);
console.log(sample.rows);
await c.end();
console.log("OK");
