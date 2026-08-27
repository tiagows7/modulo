-- Categorias de ICMS (cadastro fiscal)
-- Origem Firebird: PERcentutal_REDuzido → percentual_reduzido

CREATE TABLE IF NOT EXISTS public.categorias_icm (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo INTEGER NOT NULL UNIQUE,
    descricao VARCHAR(80) NOT NULL,
    tipo VARCHAR(1),
    aliquota_estado NUMERIC(15, 2),
    aliquota_fora NUMERIC(15, 2),
    percentual_reduzido NUMERIC(15, 2),
    csosn VARCHAR(3),
    sinal_sped VARCHAR(1),
    tabela_sped VARCHAR(15),
    cfop_estado VARCHAR(4),
    cfop_fora VARCHAR(4),
    cfop_entrada VARCHAR(4),
    cst_icms VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categorias_icm_descricao
  ON public.categorias_icm (descricao);

CREATE INDEX IF NOT EXISTS idx_categorias_icm_cst
  ON public.categorias_icm (cst_icms);

DROP TRIGGER IF EXISTS update_categorias_icm_modtime ON public.categorias_icm;
CREATE TRIGGER update_categorias_icm_modtime
    BEFORE UPDATE ON public.categorias_icm
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_icm
  TO authenticated, anon, service_role;

ALTER TABLE public.categorias_icm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - categorias_icm" ON public.categorias_icm;
CREATE POLICY "Permitir acesso autenticado - categorias_icm"
  ON public.categorias_icm FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - categorias_icm" ON public.categorias_icm;
CREATE POLICY "Permitir leitura anon - categorias_icm"
  ON public.categorias_icm FOR SELECT
  USING (true);

COMMENT ON TABLE public.categorias_icm IS 'Categorias fiscais de ICMS (alíquotas, CST, CSOSN, CFOP)';
COMMENT ON COLUMN public.categorias_icm.percentual_reduzido IS 'Original Firebird: PERcentutal_REDuzido';
