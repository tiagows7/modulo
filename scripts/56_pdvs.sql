-- Cadastro de PDVs (terminais) — série e numeração fiscal por filial

CREATE TABLE IF NOT EXISTS public.pdvs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
  codigo VARCHAR(20) NOT NULL,
  descricao VARCHAR(120),
  serie_nfce VARCHAR(3) NOT NULL DEFAULT '1',
  serie_nfe VARCHAR(3) NOT NULL DEFAULT '1',
  prox_numero_nfce INTEGER NOT NULL DEFAULT 1,
  prox_numero_nfe INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pdvs_filial_codigo_key UNIQUE (filial, codigo)
);

CREATE INDEX IF NOT EXISTS idx_pdvs_filial ON public.pdvs (filial);
CREATE INDEX IF NOT EXISTS idx_pdvs_status ON public.pdvs (status);

DROP TRIGGER IF EXISTS update_pdvs_modtime ON public.pdvs;
CREATE TRIGGER update_pdvs_modtime
  BEFORE UPDATE ON public.pdvs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdvs
  TO authenticated, anon, service_role;

ALTER TABLE public.pdvs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - pdvs" ON public.pdvs;
CREATE POLICY "Permitir acesso autenticado - pdvs"
  ON public.pdvs FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - pdvs" ON public.pdvs;
CREATE POLICY "Permitir leitura anon - pdvs"
  ON public.pdvs FOR SELECT
  USING (true);

COMMENT ON TABLE public.pdvs IS
  'Terminais PDV por filial (código, séries e próximos números NFC-e/NF-e)';
COMMENT ON COLUMN public.pdvs.codigo IS
  'Código do terminal (ex.: 1), alinhado ao pdv do caixa/localStorage';
COMMENT ON COLUMN public.pdvs.serie_nfce IS
  'Série padrão para emissão de NFC-e neste PDV';
COMMENT ON COLUMN public.pdvs.serie_nfe IS
  'Série padrão para emissão de NF-e neste PDV';
