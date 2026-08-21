-- Documentos de caixa (formas de recebimento: dinheiro, cartão, etc.)
CREATE TABLE IF NOT EXISTS public.documentos_caixa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documentos_caixa_descricao
  ON public.documentos_caixa (descricao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_caixa
  TO authenticated, anon, service_role;

ALTER TABLE public.documentos_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - documentos_caixa" ON public.documentos_caixa;
CREATE POLICY "Permitir acesso autenticado - documentos_caixa"
  ON public.documentos_caixa FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - documentos_caixa" ON public.documentos_caixa;
CREATE POLICY "Permitir leitura anon - documentos_caixa"
  ON public.documentos_caixa FOR SELECT
  USING (true);

-- Seed inicial (idempotente por descrição)
INSERT INTO public.documentos_caixa (codigo, descricao, status)
SELECT v.codigo, v.descricao, 'ativo'
FROM (VALUES
  ('DOC-001', 'Dinheiro'),
  ('DOC-002', 'Cartão'),
  ('DOC-003', 'TEF'),
  ('DOC-004', 'PIX'),
  ('DOC-005', 'Vale / Frota'),
  ('DOC-006', 'Cheque')
) AS v(codigo, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM public.documentos_caixa d WHERE d.descricao = v.descricao
);
