-- Unidades de medida (produtos / NF-e)

CREATE TABLE IF NOT EXISTS public.unidade_medida (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(6) NOT NULL UNIQUE,
    descricao VARCHAR(80) NOT NULL,
    -- Casas decimais permitidas na quantidade (0 = inteiro, 3 = kg/litro etc.)
    "decimal" SMALLINT NOT NULL DEFAULT 0
      CHECK ("decimal" >= 0 AND "decimal" <= 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unidade_medida_descricao
  ON public.unidade_medida (descricao);

DROP TRIGGER IF EXISTS update_unidade_medida_modtime ON public.unidade_medida;
CREATE TRIGGER update_unidade_medida_modtime
    BEFORE UPDATE ON public.unidade_medida
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidade_medida
  TO authenticated, anon, service_role;

ALTER TABLE public.unidade_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - unidade_medida" ON public.unidade_medida;
CREATE POLICY "Permitir acesso autenticado - unidade_medida"
  ON public.unidade_medida FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - unidade_medida" ON public.unidade_medida;
CREATE POLICY "Permitir leitura anon - unidade_medida"
  ON public.unidade_medida FOR SELECT
  USING (true);

COMMENT ON TABLE public.unidade_medida IS 'Unidades de medida comerciais (UN, KG, L, etc.)';
COMMENT ON COLUMN public.unidade_medida."decimal" IS 'Quantidade de casas decimais aceitas na quantidade';

-- Seed comum
INSERT INTO public.unidade_medida (codigo, descricao, "decimal")
VALUES
  ('UN', 'Unidade', 0),
  ('PC', 'Peca', 0),
  ('CX', 'Caixa', 0),
  ('DZ', 'Duzia', 0),
  ('KG', 'Quilograma', 3),
  ('G',  'Grama', 3),
  ('L',  'Litro', 3),
  ('ML', 'Mililitro', 0),
  ('M',  'Metro', 3),
  ('M2', 'Metro quadrado', 3),
  ('M3', 'Metro cubico', 3),
  ('TON', 'Tonelada', 3),
  ('FD', 'Fardo', 0),
  ('PCT', 'Pacote', 0),
  ('RL', 'Rolo', 0)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  "decimal" = EXCLUDED."decimal",
  updated_at = CURRENT_TIMESTAMP;
