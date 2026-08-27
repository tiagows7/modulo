-- Códigos CEST (Código Especificador da Substituição Tributária)
-- Origem Firebird: CODIGO, DESCRICAO (BLOB), NCM

CREATE TABLE IF NOT EXISTS public.produto_cest (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(9) NOT NULL,
    descricao TEXT NOT NULL,
    ncm VARCHAR(8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (codigo, ncm)
);

CREATE INDEX IF NOT EXISTS idx_produto_cest_codigo
  ON public.produto_cest (codigo);

CREATE INDEX IF NOT EXISTS idx_produto_cest_ncm
  ON public.produto_cest (ncm);

DROP TRIGGER IF EXISTS update_produto_cest_modtime ON public.produto_cest;
CREATE TRIGGER update_produto_cest_modtime
    BEFORE UPDATE ON public.produto_cest
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_cest
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_cest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_cest" ON public.produto_cest;
CREATE POLICY "Permitir acesso autenticado - produto_cest"
  ON public.produto_cest FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_cest" ON public.produto_cest;
CREATE POLICY "Permitir leitura anon - produto_cest"
  ON public.produto_cest FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_cest IS 'Tabela CEST × NCM (substituição tributária)';
