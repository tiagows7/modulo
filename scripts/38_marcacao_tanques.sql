-- Marcação de tanques (medição / variação de volume)
-- produto: normalmente o produto informado no tanque (public.tanques.produto_id)

CREATE TABLE IF NOT EXISTS public.marcacao_tanques (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    tanque UUID NOT NULL REFERENCES public.tanques(id) ON DELETE RESTRICT,
    produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    marcacao_inicial NUMERIC(15, 3) DEFAULT 0,
    entradas NUMERIC(15, 3) DEFAULT 0,
    saidas_ai NUMERIC(15, 3) DEFAULT 0,
    marcacao_final NUMERIC(15, 3) DEFAULT 0,
    variacao NUMERIC(15, 3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marcacao_tanques_filial
  ON public.marcacao_tanques (filial);

CREATE INDEX IF NOT EXISTS idx_marcacao_tanques_tanque
  ON public.marcacao_tanques (tanque);

CREATE INDEX IF NOT EXISTS idx_marcacao_tanques_produto
  ON public.marcacao_tanques (produto);

CREATE INDEX IF NOT EXISTS idx_marcacao_tanques_data
  ON public.marcacao_tanques (data DESC);

CREATE INDEX IF NOT EXISTS idx_marcacao_tanques_filial_data
  ON public.marcacao_tanques (filial, data DESC);

DROP TRIGGER IF EXISTS update_marcacao_tanques_modtime ON public.marcacao_tanques;
CREATE TRIGGER update_marcacao_tanques_modtime
    BEFORE UPDATE ON public.marcacao_tanques
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marcacao_tanques
  TO authenticated, anon, service_role;

ALTER TABLE public.marcacao_tanques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - marcacao_tanques"
  ON public.marcacao_tanques;
CREATE POLICY "Permitir acesso autenticado - marcacao_tanques"
  ON public.marcacao_tanques FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - marcacao_tanques"
  ON public.marcacao_tanques;
CREATE POLICY "Permitir leitura anon - marcacao_tanques"
  ON public.marcacao_tanques FOR SELECT
  USING (true);

COMMENT ON TABLE public.marcacao_tanques IS 'Marcação de tanques (volume inicial, entradas, saídas e variação)';
COMMENT ON COLUMN public.marcacao_tanques.filial IS 'Filial (public.filial.id)';
COMMENT ON COLUMN public.marcacao_tanques.data IS 'Data da marcação dos tanques';
COMMENT ON COLUMN public.marcacao_tanques.tanque IS 'Tanque (public.tanques.id)';
COMMENT ON COLUMN public.marcacao_tanques.produto IS 'Produto do tanque (public.produtos.id / tanques.produto_id)';
COMMENT ON COLUMN public.marcacao_tanques.marcacao_inicial IS 'Volume inicial medido (L)';
COMMENT ON COLUMN public.marcacao_tanques.entradas IS 'Entradas no período (L)';
COMMENT ON COLUMN public.marcacao_tanques.saidas_ai IS 'Saídas AI no período (L)';
COMMENT ON COLUMN public.marcacao_tanques.marcacao_final IS 'Volume final medido (L)';
COMMENT ON COLUMN public.marcacao_tanques.variacao IS 'Variação do período (L)';
