-- Tabela base de caixa (PDV)
-- Scripts 39/40 adicionam sobra_falta, fechado, pdv.

CREATE TABLE IF NOT EXISTS public.caixa (
    id BIGSERIAL PRIMARY KEY,
    codigo INTEGER,
    data DATE,
    turno TEXT,
    operador TEXT,
    parametro TEXT,
    filial UUID,
    situacao INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caixa_filial ON public.caixa (filial);
CREATE INDEX IF NOT EXISTS idx_caixa_data ON public.caixa (data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa
  TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.caixa_id_seq
  TO authenticated, anon, service_role;

ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - caixa" ON public.caixa;
CREATE POLICY "Permitir acesso autenticado - caixa"
  ON public.caixa FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - caixa" ON public.caixa;
CREATE POLICY "Permitir leitura anon - caixa"
  ON public.caixa FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir escrita anon - caixa" ON public.caixa;
CREATE POLICY "Permitir escrita anon - caixa"
  ON public.caixa FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.caixa IS 'Caixa do PDV';
