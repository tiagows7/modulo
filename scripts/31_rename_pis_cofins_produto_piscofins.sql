-- Renomeia pis_cofins → produto_piscofins

ALTER TABLE IF EXISTS public.pis_cofins RENAME TO produto_piscofins;

ALTER INDEX IF EXISTS idx_pis_cofins_descricao
  RENAME TO idx_produto_piscofins_descricao;

DROP TRIGGER IF EXISTS update_pis_cofins_modtime ON public.produto_piscofins;
CREATE TRIGGER update_produto_piscofins_modtime
    BEFORE UPDATE ON public.produto_piscofins
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP POLICY IF EXISTS "Permitir acesso autenticado - pis_cofins" ON public.produto_piscofins;
DROP POLICY IF EXISTS "Permitir leitura anon - pis_cofins" ON public.produto_piscofins;
DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_piscofins" ON public.produto_piscofins;
DROP POLICY IF EXISTS "Permitir leitura anon - produto_piscofins" ON public.produto_piscofins;

CREATE POLICY "Permitir acesso autenticado - produto_piscofins"
  ON public.produto_piscofins FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir leitura anon - produto_piscofins"
  ON public.produto_piscofins FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_piscofins IS 'Cadastro de códigos/situações PIS e COFINS';
COMMENT ON COLUMN public.produto_piscofins.ind_011102 IS 'Original Firebird: 011102';
COMMENT ON COLUMN public.produto_piscofins.ind_011103 IS 'Original Firebird: 011103';
COMMENT ON COLUMN public.produto_piscofins.ind_011104 IS 'Original Firebird: 011104';
COMMENT ON COLUMN public.produto_piscofins.ind_011105 IS 'Original Firebird: 011105';
