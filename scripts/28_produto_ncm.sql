-- Códigos NCM / tabela IBPT (alíquotas aproximadas)
-- Origem Firebird: IBPTNCM, IBPTEX, IBPTTAB, IBPTDES, etc.

CREATE TABLE IF NOT EXISTS public.produto_ncm (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ibpt_ncm INTEGER NOT NULL,
    ibpt_ex VARCHAR(10),
    ibpt_tab INTEGER,
    ibpt_des VARCHAR(100) NOT NULL,
    ibpt_aliq_nac NUMERIC(15, 2),
    ibpt_aliq_imp NUMERIC(15, 2),
    ibpt_rec INTEGER,
    ibpt_aliq_est NUMERIC(15, 2),
    ibpt_aliq_mun NUMERIC(15, 2),
    ibpt_chave VARCHAR(20),
    ibpt_versao VARCHAR(10),
    ibpt_fonte VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ibpt_ncm, ibpt_ex, ibpt_tab)
);

CREATE INDEX IF NOT EXISTS idx_produto_ncm_des
  ON public.produto_ncm (ibpt_des);

CREATE INDEX IF NOT EXISTS idx_produto_ncm_ncm
  ON public.produto_ncm (ibpt_ncm);

DROP TRIGGER IF EXISTS update_produto_ncm_modtime ON public.produto_ncm;
CREATE TRIGGER update_produto_ncm_modtime
    BEFORE UPDATE ON public.produto_ncm
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_ncm
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_ncm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_ncm" ON public.produto_ncm;
CREATE POLICY "Permitir acesso autenticado - produto_ncm"
  ON public.produto_ncm FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_ncm" ON public.produto_ncm;
CREATE POLICY "Permitir leitura anon - produto_ncm"
  ON public.produto_ncm FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_ncm IS 'Tabela NCM / IBPT (alíquotas nacional, importado, estadual e municipal)';
COMMENT ON COLUMN public.produto_ncm.ibpt_ncm IS 'Original: IBPTNCM';
COMMENT ON COLUMN public.produto_ncm.ibpt_ex IS 'Original: IBPTEX (exceção)';
COMMENT ON COLUMN public.produto_ncm.ibpt_tab IS 'Original: IBPTTAB';
COMMENT ON COLUMN public.produto_ncm.ibpt_des IS 'Original: IBPTDES';
COMMENT ON COLUMN public.produto_ncm.ibpt_aliq_nac IS 'Original: IBPTALIQNAC';
COMMENT ON COLUMN public.produto_ncm.ibpt_aliq_imp IS 'Original: IBPTALIQIMP';
COMMENT ON COLUMN public.produto_ncm.ibpt_rec IS 'Original: IBPTREC';
COMMENT ON COLUMN public.produto_ncm.ibpt_aliq_est IS 'Original: IBPTALIQEST';
COMMENT ON COLUMN public.produto_ncm.ibpt_aliq_mun IS 'Original: IBPTALIQMUN';
COMMENT ON COLUMN public.produto_ncm.ibpt_chave IS 'Original: IBPTCHAVE';
COMMENT ON COLUMN public.produto_ncm.ibpt_versao IS 'Original: IBPTVERSAO';
COMMENT ON COLUMN public.produto_ncm.ibpt_fonte IS 'Original: IBPTFONTE';
