-- Renomeia ibscbs_cst → produto_ibscbs_cst
-- e ibscbs_classtrib → produto_ibscbs_classtrib

ALTER TABLE IF EXISTS public.ibscbs_cst RENAME TO produto_ibscbs_cst;
ALTER TABLE IF EXISTS public.ibscbs_classtrib RENAME TO produto_ibscbs_classtrib;

ALTER INDEX IF EXISTS idx_ibscbs_cst_descricao
  RENAME TO idx_produto_ibscbs_cst_descricao;

ALTER INDEX IF EXISTS idx_ibscbs_classtrib_cst
  RENAME TO idx_produto_ibscbs_classtrib_cst;

ALTER INDEX IF EXISTS idx_ibscbs_classtrib_codigo
  RENAME TO idx_produto_ibscbs_classtrib_codigo;

DROP TRIGGER IF EXISTS update_ibscbs_cst_modtime ON public.produto_ibscbs_cst;
DROP TRIGGER IF EXISTS update_produto_ibscbs_cst_modtime ON public.produto_ibscbs_cst;
CREATE TRIGGER update_produto_ibscbs_cst_modtime
    BEFORE UPDATE ON public.produto_ibscbs_cst
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_ibscbs_classtrib_modtime ON public.produto_ibscbs_classtrib;
DROP TRIGGER IF EXISTS update_produto_ibscbs_classtrib_modtime ON public.produto_ibscbs_classtrib;
CREATE TRIGGER update_produto_ibscbs_classtrib_modtime
    BEFORE UPDATE ON public.produto_ibscbs_classtrib
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP POLICY IF EXISTS "Permitir acesso autenticado - ibscbs_cst" ON public.produto_ibscbs_cst;
DROP POLICY IF EXISTS "Permitir leitura anon - ibscbs_cst" ON public.produto_ibscbs_cst;
DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_ibscbs_cst" ON public.produto_ibscbs_cst;
DROP POLICY IF EXISTS "Permitir leitura anon - produto_ibscbs_cst" ON public.produto_ibscbs_cst;

CREATE POLICY "Permitir acesso autenticado - produto_ibscbs_cst"
  ON public.produto_ibscbs_cst FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir leitura anon - produto_ibscbs_cst"
  ON public.produto_ibscbs_cst FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir acesso autenticado - ibscbs_classtrib" ON public.produto_ibscbs_classtrib;
DROP POLICY IF EXISTS "Permitir leitura anon - ibscbs_classtrib" ON public.produto_ibscbs_classtrib;
DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_ibscbs_classtrib" ON public.produto_ibscbs_classtrib;
DROP POLICY IF EXISTS "Permitir leitura anon - produto_ibscbs_classtrib" ON public.produto_ibscbs_classtrib;

CREATE POLICY "Permitir acesso autenticado - produto_ibscbs_classtrib"
  ON public.produto_ibscbs_classtrib FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir leitura anon - produto_ibscbs_classtrib"
  ON public.produto_ibscbs_classtrib FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_ibscbs_cst IS 'CSTs do IBS/CBS (grupos de informação da reforma tributária)';
COMMENT ON TABLE public.produto_ibscbs_classtrib IS 'Classificação tributária IBS/CBS vinculada ao CST';
COMMENT ON COLUMN public.produto_ibscbs_cst.ind_gcredpresibszfm IS 'Original Firebird: IBSCBSCST_IND_ GCREDPRESIBSZFM';
