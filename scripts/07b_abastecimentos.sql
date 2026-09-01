-- Tabela base de abastecimentos (PDV / concentrador)
-- Scripts 08/09/10 apenas adicionam colunas.

CREATE TABLE IF NOT EXISTS public.abastecimentos (
    id BIGSERIAL PRIMARY KEY,
    bico VARCHAR(10),
    numero INTEGER,
    litros NUMERIC(15, 3) DEFAULT 0,
    preco NUMERIC(15, 4) DEFAULT 0,
    valor NUMERIC(15, 2) DEFAULT 0,
    aba INTEGER,
    operador TEXT,
    operador_nome TEXT,
    produto TEXT,
    produto_codigo INTEGER,
    hora TIMESTAMPTZ,
    situacao INTEGER DEFAULT 0,
    selecionado_app INTEGER,
    cartao_nsu TEXT,
    cartao_hora TIMESTAMPTZ,
    baixado INTEGER DEFAULT 0,
    pdv TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_situacao
  ON public.abastecimentos (situacao);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_hora
  ON public.abastecimentos (hora DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abastecimentos
  TO authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.abastecimentos_id_seq
  TO authenticated, anon, service_role;

ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - abastecimentos"
  ON public.abastecimentos;
CREATE POLICY "Permitir acesso autenticado - abastecimentos"
  ON public.abastecimentos FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - abastecimentos"
  ON public.abastecimentos;
CREATE POLICY "Permitir leitura anon - abastecimentos"
  ON public.abastecimentos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir escrita anon - abastecimentos"
  ON public.abastecimentos;
CREATE POLICY "Permitir escrita anon - abastecimentos"
  ON public.abastecimentos FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.abastecimentos IS 'Abastecimentos do concentrador / PDV';
