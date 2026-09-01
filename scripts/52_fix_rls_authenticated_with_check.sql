-- Corrige políticas "Permitir acesso autenticado" para INSERT/UPDATE
-- terem WITH CHECK explícito (sem isso o PostgREST pode falhar no save).

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
