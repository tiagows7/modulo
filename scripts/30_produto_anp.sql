-- Códigos de produto ANP (combustíveis / lubrificantes)

CREATE TABLE IF NOT EXISTS public.produto_anp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(9) NOT NULL UNIQUE,
    descricao VARCHAR(100) NOT NULL,
    combustivel CHAR(1) NOT NULL DEFAULT 'S'
      CHECK (combustivel IN ('S', 'N')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_anp_descricao
  ON public.produto_anp (descricao);

CREATE INDEX IF NOT EXISTS idx_produto_anp_combustivel
  ON public.produto_anp (combustivel);

DROP TRIGGER IF EXISTS update_produto_anp_modtime ON public.produto_anp;
CREATE TRIGGER update_produto_anp_modtime
    BEFORE UPDATE ON public.produto_anp
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_anp
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_anp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_anp" ON public.produto_anp;
CREATE POLICY "Permitir acesso autenticado - produto_anp"
  ON public.produto_anp FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_anp" ON public.produto_anp;
CREATE POLICY "Permitir leitura anon - produto_anp"
  ON public.produto_anp FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_anp IS 'Códigos de produto ANP (NF-e combustível)';
COMMENT ON COLUMN public.produto_anp.combustivel IS 'S = combustível / N = outros (lubrificante etc.)';

-- Seed códigos ANP mais usados em posto / NF-e
INSERT INTO public.produto_anp (codigo, descricao, combustivel)
VALUES
  ('210203001', 'Gasolina C comum', 'S'),
  ('210203002', 'Gasolina C aditivada', 'S'),
  ('210203003', 'Gasolina C premium', 'S'),
  ('210203004', 'Gasolina de aviacao', 'S'),
  ('220101002', 'Etanol hidratado combustivel', 'S'),
  ('220101003', 'Etanol hidratado aditivado', 'S'),
  ('220101004', 'Etanol anidro combustivel', 'S'),
  ('820101001', 'Oleo diesel A S10', 'S'),
  ('820101012', 'Oleo diesel B S10', 'S'),
  ('820101013', 'Oleo diesel B S10 aditivado', 'S'),
  ('820101033', 'Oleo diesel A S500', 'S'),
  ('820101034', 'Oleo diesel B S500', 'S'),
  ('820101026', 'Oleo diesel maritimo', 'S'),
  ('320101001', 'GNV - gas natural veicular', 'S'),
  ('320102001', 'GLP - gas liquefeito de petroleo', 'S'),
  ('420105001', 'Querosene de aviacao', 'S'),
  ('420101003', 'Querosene iluminante', 'S'),
  ('610101001', 'Oleo lubrificante acabado automotivo', 'N'),
  ('610101005', 'Oleo lubrificante acabado industrial', 'N'),
  ('620501003', 'Graxa lubrificante', 'N')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  combustivel = EXCLUDED.combustivel,
  updated_at = CURRENT_TIMESTAMP;
