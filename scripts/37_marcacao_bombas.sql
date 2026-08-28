-- Marcação de bombas (encerrante / medição por bico no turno do caixa)
-- Origem operacional: bico → tanque → produto; caixa (número, data, turno, operador)

CREATE TABLE IF NOT EXISTS public.marcacao_bombas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
    bico UUID NOT NULL REFERENCES public.bicos(id) ON DELETE RESTRICT,
    tanque UUID REFERENCES public.tanques(id) ON DELETE SET NULL,
    caixa INTEGER NOT NULL,
    data DATE NOT NULL,
    turno TEXT,
    operador TEXT,
    medicao_inicial NUMERIC(15, 3) DEFAULT 0,
    medicao_final NUMERIC(15, 3) DEFAULT 0,
    afericao NUMERIC(15, 3) DEFAULT 0,
    unitario NUMERIC(7, 3) DEFAULT 0,
    desconto NUMERIC(15, 2) DEFAULT 0,
    acrescimo NUMERIC(15, 2) DEFAULT 0,
    produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    venda_quantidade NUMERIC(15, 2) DEFAULT 0,
    venda_total NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_filial
  ON public.marcacao_bombas (filial);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_bico
  ON public.marcacao_bombas (bico);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_tanque
  ON public.marcacao_bombas (tanque);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_produto
  ON public.marcacao_bombas (produto);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_caixa
  ON public.marcacao_bombas (caixa);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_data
  ON public.marcacao_bombas (data DESC);

CREATE INDEX IF NOT EXISTS idx_marcacao_bombas_caixa_data_turno
  ON public.marcacao_bombas (caixa, data, turno);

DROP TRIGGER IF EXISTS update_marcacao_bombas_modtime ON public.marcacao_bombas;
CREATE TRIGGER update_marcacao_bombas_modtime
    BEFORE UPDATE ON public.marcacao_bombas
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marcacao_bombas
  TO authenticated, anon, service_role;

ALTER TABLE public.marcacao_bombas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - marcacao_bombas"
  ON public.marcacao_bombas;
CREATE POLICY "Permitir acesso autenticado - marcacao_bombas"
  ON public.marcacao_bombas FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - marcacao_bombas"
  ON public.marcacao_bombas;
CREATE POLICY "Permitir leitura anon - marcacao_bombas"
  ON public.marcacao_bombas FOR SELECT
  USING (true);

COMMENT ON TABLE public.marcacao_bombas IS 'Marcação de bombas (medição inicial/final, aferição e venda do bico no caixa)';
COMMENT ON COLUMN public.marcacao_bombas.filial IS 'Filial (public.filial.id)';
COMMENT ON COLUMN public.marcacao_bombas.bico IS 'Bico (public.bicos.id)';
COMMENT ON COLUMN public.marcacao_bombas.tanque IS 'Tanque (public.tanques.id)';
COMMENT ON COLUMN public.marcacao_bombas.caixa IS 'Número/código do caixa (public.caixa.codigo)';
COMMENT ON COLUMN public.marcacao_bombas.data IS 'Data do caixa';
COMMENT ON COLUMN public.marcacao_bombas.turno IS 'Turno do caixa';
COMMENT ON COLUMN public.marcacao_bombas.operador IS 'Operador do caixa';
COMMENT ON COLUMN public.marcacao_bombas.medicao_inicial IS 'Encerrante / medição inicial do bico';
COMMENT ON COLUMN public.marcacao_bombas.medicao_final IS 'Encerrante / medição final do bico';
COMMENT ON COLUMN public.marcacao_bombas.afericao IS 'Volume de aferição (L)';
COMMENT ON COLUMN public.marcacao_bombas.unitario IS 'Preço unitário do produto no período';
COMMENT ON COLUMN public.marcacao_bombas.produto IS 'Produto do bico (public.produtos.id)';
COMMENT ON COLUMN public.marcacao_bombas.venda_quantidade IS 'Quantidade vendida no período';
COMMENT ON COLUMN public.marcacao_bombas.venda_total IS 'Valor total de venda no período';
