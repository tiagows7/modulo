-- Cadastro de Filial + vínculo nas tabelas operacionais

CREATE TABLE IF NOT EXISTS public.filial (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  fantasia VARCHAR(255),
  cnpj VARCHAR(20),
  inscricao_estadual VARCHAR(30),
  inscricao_municipal VARCHAR(30),
  cep VARCHAR(12),
  endereco VARCHAR(255),
  endereco_numero VARCHAR(30),
  endereco_bairro VARCHAR(120),
  endereco_uf VARCHAR(2) REFERENCES public.uf(codigo),
  endereco_cidade INTEGER,
  telefone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_filial_cnpj ON public.filial (cnpj);
CREATE INDEX IF NOT EXISTS idx_filial_uf ON public.filial (endereco_uf);
CREATE INDEX IF NOT EXISTS idx_filial_cidade ON public.filial (endereco_cidade);

DROP TRIGGER IF EXISTS update_filial_modtime ON public.filial;
CREATE TRIGGER update_filial_modtime
  BEFORE UPDATE ON public.filial
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.filial ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'filial' AND policyname = 'filial_all'
  ) THEN
    CREATE POLICY filial_all ON public.filial FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.filial TO authenticated, anon, service_role;

-- Vínculo nas tabelas (UUID → filial.id)
ALTER TABLE public.bicos
  ADD COLUMN IF NOT EXISTS filial UUID REFERENCES public.filial(id) ON DELETE SET NULL;

ALTER TABLE public.tanques
  ADD COLUMN IF NOT EXISTS filial UUID REFERENCES public.filial(id) ON DELETE SET NULL;

ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS filial UUID REFERENCES public.filial(id) ON DELETE SET NULL;

-- caixa.filial já existe como text (armazena codigo da filial)
COMMENT ON COLUMN public.caixa.filial IS 'Código da filial (public.filial.codigo)';

CREATE INDEX IF NOT EXISTS idx_bicos_filial ON public.bicos (filial);
CREATE INDEX IF NOT EXISTS idx_tanques_filial ON public.tanques (filial);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_filial ON public.abastecimentos (filial);

COMMENT ON TABLE public.filial IS 'Cadastro de filiais do posto';
COMMENT ON COLUMN public.filial.endereco_uf IS 'UF (public.uf.codigo)';
COMMENT ON COLUMN public.filial.endereco_cidade IS 'Código IBGE do município (public.cidades.codigo)';
COMMENT ON COLUMN public.bicos.filial IS 'Filial (public.filial.id)';
COMMENT ON COLUMN public.tanques.filial IS 'Filial (public.filial.id)';
COMMENT ON COLUMN public.abastecimentos.filial IS 'Filial (public.filial.id)';
