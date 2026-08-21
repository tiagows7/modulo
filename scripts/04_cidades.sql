-- Tabela de cidades (municípios IBGE)
CREATE TABLE IF NOT EXISTS public.cidades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    uf VARCHAR(2) NOT NULL REFERENCES public.uf(codigo),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cidades_uf ON public.cidades (uf);
CREATE INDEX IF NOT EXISTS idx_cidades_descricao ON public.cidades (descricao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cidades TO authenticated, anon, service_role;

ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - cidades" ON public.cidades;
CREATE POLICY "Permitir acesso autenticado - cidades"
  ON public.cidades FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - cidades" ON public.cidades;
CREATE POLICY "Permitir leitura anon - cidades"
  ON public.cidades FOR SELECT
  USING (true);
