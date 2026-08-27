-- Tabelas fiscais IBS/CBS (reforma tributária)
-- Origem Firebird: IBSCBS_CST / IBSCBS_CLASSTRIB (CCLASTRIB_*)

CREATE TABLE IF NOT EXISTS public.ibscbs_cst (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cst INTEGER NOT NULL UNIQUE,
    descricao VARCHAR(100) NOT NULL,
    ind_gibscbs INTEGER,
    ind_gibscbsmono INTEGER,
    ind_gred INTEGER,
    ind_gdif INTEGER,
    ind_gtransfcred INTEGER,
    -- Firebird: "IBSCBSCST_IND_ GCREDPRESIBSZFM" (espaço no nome original)
    ind_gcredpresibszfm INTEGER,
    ind_gajustecompet INTEGER,
    ind_redutorbc INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ibscbs_classtrib (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cst INTEGER NOT NULL REFERENCES public.ibscbs_cst(cst) ON DELETE RESTRICT,
    codigo VARCHAR(6) NOT NULL,
    nome VARCHAR(300) NOT NULL,
    descricao TEXT,
    redacao TEXT,
    lc VARCHAR(100),
    tipo_aliquota VARCHAR(100),
    red_ibs NUMERIC(15, 2),
    red_cbs NUMERIC(15, 2),
    trib_regular INTEGER,
    cred_pres_oper INTEGER,
    mono_padrao INTEGER,
    mono_reten INTEGER,
    mono_ret INTEGER,
    mono_dif INTEGER,
    estorno_cred INTEGER,
    inicio_vigencia DATE,
    final_vigencia DATE,
    data_atualizacao DATE,
    ind_nfe_abi INTEGER,
    ind_nfe INTEGER,
    ind_nfce INTEGER,
    ind_cte INTEGER,
    ind_cteos INTEGER,
    ind_bpe INTEGER,
    ind_bpeta INTEGER,
    ind_bpetm INTEGER,
    ind_nf3e INTEGER,
    ind_nfse INTEGER,
    ind_nfsevia INTEGER,
    ind_nfcom INTEGER,
    ind_nfag INTEGER,
    ind_nfgas INTEGER,
    ind_dere INTEGER,
    anexo INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cst, codigo)
);

CREATE INDEX IF NOT EXISTS idx_ibscbs_cst_descricao
  ON public.ibscbs_cst (descricao);

CREATE INDEX IF NOT EXISTS idx_ibscbs_classtrib_cst
  ON public.ibscbs_classtrib (cst);

CREATE INDEX IF NOT EXISTS idx_ibscbs_classtrib_codigo
  ON public.ibscbs_classtrib (codigo);

DROP TRIGGER IF EXISTS update_ibscbs_cst_modtime ON public.ibscbs_cst;
CREATE TRIGGER update_ibscbs_cst_modtime
    BEFORE UPDATE ON public.ibscbs_cst
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_ibscbs_classtrib_modtime ON public.ibscbs_classtrib;
CREATE TRIGGER update_ibscbs_classtrib_modtime
    BEFORE UPDATE ON public.ibscbs_classtrib
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ibscbs_cst
  TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ibscbs_classtrib
  TO authenticated, anon, service_role;

ALTER TABLE public.ibscbs_cst ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibscbs_classtrib ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - ibscbs_cst" ON public.ibscbs_cst;
CREATE POLICY "Permitir acesso autenticado - ibscbs_cst"
  ON public.ibscbs_cst FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - ibscbs_cst" ON public.ibscbs_cst;
CREATE POLICY "Permitir leitura anon - ibscbs_cst"
  ON public.ibscbs_cst FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir acesso autenticado - ibscbs_classtrib" ON public.ibscbs_classtrib;
CREATE POLICY "Permitir acesso autenticado - ibscbs_classtrib"
  ON public.ibscbs_classtrib FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - ibscbs_classtrib" ON public.ibscbs_classtrib;
CREATE POLICY "Permitir leitura anon - ibscbs_classtrib"
  ON public.ibscbs_classtrib FOR SELECT
  USING (true);

COMMENT ON TABLE public.ibscbs_cst IS 'CSTs do IBS/CBS (grupos de informação da reforma tributária)';
COMMENT ON TABLE public.ibscbs_classtrib IS 'Classificação tributária IBS/CBS vinculada ao CST';
COMMENT ON COLUMN public.ibscbs_cst.ind_gcredpresibszfm IS 'Original Firebird: IBSCBSCST_IND_ GCREDPRESIBSZFM';
